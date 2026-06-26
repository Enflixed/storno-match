import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';

// ─── Generate Tokens ───
export function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// ─── Authenticate JWT ───
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      organizationId: decoded.organizationId,
      role: decoded.role,
      emailHash: crypto.createHash('sha256').update(decoded.email.toLowerCase()).digest('hex')
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Authenticate API Key (for widget) ───
export async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('ApiKey ', '');

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // Hash the provided key to compare
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyPrefix = apiKey.substring(0, 8);

  try {
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        keyPrefix,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        // Just to verify org exists
      }
    });

    if (!apiKeyRecord) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() }
    });

    req.organizationId = apiKeyRecord.organizationId;
    req.apiKeyId = apiKeyRecord.id;
    
    next();
  } catch (err) {
    console.error('API key auth error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// ─── Generate API Key ───
export async function generateApiKey(organizationId, name = 'Primary') {
  const plainTextKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(plainTextKey).digest('hex');
  const keyPrefix = plainTextKey.substring(0, 8);

  const apiKey = await prisma.apiKey.create({
    data: {
      organizationId,
      keyHash,
      keyPrefix,
      name,
      active: true
    }
  });

  return {
    id: apiKey.id,
    plainText: plainTextKey,
    prefix: keyPrefix,
    name
  };
}

// ─── Role Check Middleware ───
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
