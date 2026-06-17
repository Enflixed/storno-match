import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// ─── GET /admin/stats ───
// Platform-wide statistics (admin only)
router.get('/stats', authenticate, requireRole('OWNER'), async (req, res) => {
  try {
    const [
      totalOrganizations,
      totalUsers,
      totalListings,
      totalTransfers,
      totalRevenue,
      recentTransfers
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.listing.count(),
      prisma.transfer.count({ where: { status: 'COMPLETED' } }),
      prisma.transfer.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { platformFeeCents: true }
      }),
      prisma.transfer.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { name: true } },
          listing: { select: { destination: true } }
        }
      })
    ]);

    res.json({
      stats: {
        organizations: totalOrganizations,
        users: totalUsers,
        listings: totalListings,
        completedTransfers: totalTransfers,
        platformRevenue: totalRevenue._sum.platformFeeCents || 0,
        recentTransfers
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /admin/organizations ───
router.get('/organizations', authenticate, requireRole('OWNER'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        take: parseInt(limit),
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          subdomain: true,
          plan: true,
          stripeOnboarded: true,
          contactEmail: true,
          createdAt: true,
          _count: {
            select: { listings: true, transfers: true }
          }
        }
      }),
      prisma.organization.count()
    ]);

    res.json({
      organizations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Admin organizations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /admin/transfers ───
router.get('/transfers', authenticate, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = status ? { status } : {};

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        take: parseInt(limit),
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { name: true, subdomain: true } },
          listing: { select: { destination: true, departureDate: true } }
        }
      }),
      prisma.transfer.count({ where })
    ]);

    res.json({
      transfers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Admin transfers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
