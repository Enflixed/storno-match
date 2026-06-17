import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { authenticate, generateTokens, generateApiKey } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// ─── Validation Schemas ───
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  organizationName: Joi.string().min(2).max(100).required(),
  subdomain: Joi.string().min(2).max(50).pattern(/^[a-z0-9-]+$/).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// ─── POST /auth/register ───
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, password, organizationName, subdomain } = value;

    // Check if email exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if subdomain exists
    const existingOrg = await prisma.organization.findUnique({ where: { subdomain } });
    if (existingOrg) {
      return res.status(400).json({ error: 'Subdomain already taken' });
    }

    // Create organization + owner user
    const passwordHash = await bcrypt.hash(password, 12);
    
    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        subdomain,
        contactEmail: email,
        contactName: name,
        users: {
          create: {
            name,
            email,
            passwordHash,
            role: 'OWNER'
          }
        }
      },
      include: { users: true }
    });

    // Generate API key for the organization
    const apiKey = await generateApiKey(organization.id);

    // Generate JWT
    const tokens = generateTokens(organization.users[0]);

    res.status(201).json({
      message: 'Organization registered successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain,
        plan: organization.plan
      },
      user: {
        id: organization.users[0].id,
        name: organization.users[0].name,
        email: organization.users[0].email,
        role: organization.users[0].role
      },
      apiKey: apiKey.plainText, // Only returned once!
      tokens
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /auth/login ───
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const tokens = generateTokens(user);

    res.json({
      message: 'Login successful',
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        subdomain: user.organization.subdomain,
        plan: user.organization.plan,
        stripeOnboarded: user.organization.stripeOnboarded
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      tokens
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /auth/refresh ───
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { organization: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokens = generateTokens(user);
    res.json({ tokens });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── POST /auth/logout ───
router.post('/logout', authenticate, async (req, res) => {
  // In a production app, you'd invalidate the refresh token here
  res.json({ message: 'Logged out successfully' });
});

// ─── GET /auth/me ───
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    include: { 
      organization: {
        select: {
          id: true,
          name: true,
          subdomain: true,
          plan: true,
          stripeOnboarded: true,
          minPricePercent: true,
          maxPricePercent: true,
          timeLockHours: true
        }
      }
    }
  });

  res.json({ user });
});

export default router;
