import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';

import authRoutes from './routes/auth.js';
import listingRoutes from './routes/listings.js';
import transferRoutes from './routes/transfers.js';
import organizationRoutes from './routes/organizations.js';
import webhookRoutes from './routes/webhooks.js';
import adminRoutes from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';

config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ───
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// ─── Rate Limiting ───
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ─── Stripe Webhooks need raw body ───
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// ─── Regular middleware ───
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ─── Health Check ───
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0'
  });
});

// ─── Static Files (Widget + Dashboard) ───
app.use('/widget', express.static('../widget'));
app.use('/dashboard', express.static('../dashboard'));

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);

// ─── API Documentation ───
app.get('/api', (req, res) => {
  res.json({
    name: 'StornoMatch API',
    version: '0.1.0',
    description: 'B2B White Label Zweitmarkt für Reiseveranstalter',
    endpoints: {
      health: 'GET /health',
      auth: {
        'POST /api/auth/register': 'Register new organization',
        'POST /api/auth/login': 'Login',
        'POST /api/auth/refresh': 'Refresh token',
        'POST /api/auth/logout': 'Logout'
      },
      listings: {
        'GET /api/listings': 'List all active listings',
        'GET /api/listings/:id': 'Get listing details',
        'POST /api/listings': 'Create listing (seller)',
        'PUT /api/listings/:id': 'Update listing',
        'DELETE /api/listings/:id': 'Cancel listing'
      },
      transfers: {
        'GET /api/transfers': 'List transfers',
        'GET /api/transfers/:id': 'Get transfer details',
        'POST /api/transfers': 'Initiate transfer (buy)',
        'POST /api/transfers/:id/confirm': 'Confirm receipt (seller)',
        'POST /api/transfers/:id/reject': 'Reject transfer (agency)'
      },
      webhooks: {
        'POST /api/webhooks/stripe': 'Stripe webhook handler'
      }
    }
  });
});

// ─── Error Handler ───
app.use(errorHandler);

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║           STORNOMATCH SERVER STARTED              ║
╠═══════════════════════════════════════════════════╣
║  Port:     ${PORT}                                  ║
║  Env:      ${process.env.NODE_ENV || 'development'}                       ║
║  Database: ${process.env.DATABASE_URL ? '✓ Connected' : '✗ Not configured'}     ║
║  Stripe:   ${process.env.STRIPE_SECRET_KEY ? '✓ Configured' : '✗ Not configured'}     ║
╚═══════════════════════════════════════════════════╝
  `);
});

export default app;
