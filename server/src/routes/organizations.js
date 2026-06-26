import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { createConnectAccount, createAccountLink, getConnectAccountStatus } from '../services/stripe.js';

const router = Router();
const prisma = new PrismaClient();

// ─── GET /organizations ───
router.get('/', authenticate, async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId }
    });

    res.json({ organization: org });
  } catch (err) {
    console.error('Get organization error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /organizations ───
router.put('/', authenticate, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const {
      name,
      logoUrl,
      contactName,
      contactEmail,
      phone,
      website,
      minPricePercent,
      maxPricePercent,
      timeLockHours
    } = req.body;

    const org = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: {
        name,
        logoUrl,
        contactName,
        contactEmail,
        phone,
        website,
        minPricePercent,
        maxPricePercent,
        timeLockHours
      }
    });

    res.json({ organization: org });
  } catch (err) {
    console.error('Update organization error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /organizations/stripe/connect ───
// Start Stripe Connect onboarding
router.post('/stripe/connect', authenticate, requireRole('OWNER'), async (req, res) => {
  try {
    const { url: callbackUrl } = req.body;
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId }
    });

    let accountId = org.stripeAccountId;

    // Create new Connect account if doesn't exist
    if (!accountId) {
      const account = await createConnectAccount(org, org.contactEmail);
      accountId = account.id;

      await prisma.organization.update({
        where: { id: org.id },
        data: { stripeAccountId: accountId }
      });
    }

    // Create account link for onboarding
    const accountLink = await createAccountLink(
      accountId,
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/settings/stripe/refresh`,
      callbackUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/settings/stripe`
    );

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('Stripe connect error:', err);
    res.status(500).json({ error: 'Failed to start Stripe onboarding' });
  }
});

// ─── GET /organizations/stripe/status ───
router.get('/stripe/status', authenticate, requireRole('OWNER'), async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId }
    });

    if (!org.stripeAccountId) {
      return res.json({ 
        status: 'not_connected',
        message: 'No Stripe account connected'
      });
    }

    const status = await getConnectAccountStatus(org.stripeAccountId);

    res.json({ 
      status: status.chargesEnabled ? 'active' : 'pending',
      ...status
    });
  } catch (err) {
    console.error('Stripe status error:', err);
    res.status(500).json({ error: 'Failed to get Stripe status' });
  }
});

// ─── GET /organizations/stats ───
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    
    let dateFilter = new Date();
    if (range === '7d') dateFilter.setDate(dateFilter.getDate() - 7);
    else if (range === '30d') dateFilter.setDate(dateFilter.getDate() - 30);
    else if (range === '90d') dateFilter.setDate(dateFilter.getDate() - 90);

    const [listingsCount, transfersCount, revenueResult] = await Promise.all([
      prisma.listing.count({
        where: { organizationId: req.user.organizationId }
      }),
      prisma.transfer.count({
        where: { 
          organizationId: req.user.organizationId,
          status: 'COMPLETED'
        }
      }),
      prisma.transfer.aggregate({
        where: {
          organizationId: req.user.organizationId,
          status: 'COMPLETED',
          completedAt: { gte: dateFilter }
        },
        _sum: { sellerPayoutCents: true }
      })
    ]);

    const revenue = revenueResult._sum.sellerPayoutCents || 0;

    res.json({
      stats: {
        totalListings: listingsCount,
        completedTransfers: transfersCount,
        revenueCents: revenue,
        revenueEur: (revenue / 100).toFixed(2),
        period: range
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /organizations/:subdomain ───
// Public: get organization info for widget (MUST be last - catches all /organizations/*)
router.get('/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;

    const org = await prisma.organization.findUnique({
      where: { subdomain },
      select: {
        id: true,
        name: true,
        subdomain: true,
        logoUrl: true,
        stripeOnboarded: true,
        minPricePercent: true,
        maxPricePercent: true,
        timeLockHours: true,
        website: true
      }
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({ organization: org });
  } catch (err) {
    console.error('Get organization error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
