import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import crypto from 'crypto';
import { authenticate, authenticateApiKey } from '../middleware/auth.js';
import { createPaymentIntent } from '../services/stripe.js';

const router = Router();
const prisma = new PrismaClient();

// ─── Validation Schemas ───
const createListingSchema = Joi.object({
  originalBookingRef: Joi.string().required(),
  destination: Joi.string().min(2).max(200).required(),
  departureDate: Joi.date().min('now').required(),
  returnDate: Joi.date().greater(Joi.ref('departureDate')).required(),
  originalPriceCents: Joi.number().integer().min(1).required(),
  askingPriceCents: Joi.number().integer().min(1).required(),
  description: Joi.string().max(1000).allow('').optional(),
  sellerName: Joi.string().min(2).max(50).required(),
  sellerEmail: Joi.string().email().required(),
  sellerPhone: Joi.string().max(20).allow('').optional()
});

const updateListingSchema = Joi.object({
  askingPriceCents: Joi.number().integer().min(1).optional(),
  description: Joi.string().max(1000).allow('').optional()
});

// ─── GET /listings ───
// Public: get active listings for an organization
router.get('/', async (req, res) => {
  try {
    const { org, status = 'ACTIVE', limit = 50, offset = 0 } = req.query;

    const where = {
      status: status === 'all' ? undefined : status
    };

    if (org) {
      where.organization = { subdomain: org };
    } else {
      // Only show listings from onboarded organizations
      where.organization = { stripeOnboarded: true };
    }

    // Don't show listings about to expire or past time lock
    const now = new Date();
    where.departureDate = { gt: now };

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        take: parseInt(limit),
        skip: parseInt(offset),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          destination: true,
          departureDate: true,
          returnDate: true,
          originalPriceCents: true,
          askingPriceCents: true,
          currency: true,
          description: true,
          sellerNameAnonymous: true,
          status: true,
          createdAt: true,
          organization: {
            select: {
              name: true,
              subdomain: true,
              logoUrl: true
            }
          }
        }
      }),
      prisma.listing.count({ where })
    ]);

    res.json({
      listings,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + listings.length < total
      }
    });
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /listings/:id ───
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            logoUrl: true,
            contactEmail: true
          }
        }
      }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check time lock
    const now = new Date();
    const hoursUntilDeparture = (listing.departureDate - now) / (1000 * 60 * 60);
    
    if (hoursUntilDeparture <= listing.organization.timeLockHours) {
      return res.status(410).json({ 
        error: 'Transfer period has ended',
        timeLockHours: listing.organization.timeLockHours
      });
    }

    // Remove sensitive data
    const publicListing = {
      id: listing.id,
      destination: listing.destination,
      departureDate: listing.departureDate,
      returnDate: listing.returnDate,
      originalPriceCents: listing.originalPriceCents,
      askingPriceCents: listing.askingPriceCents,
      askingPriceEur: (listing.askingPriceCents / 100).toFixed(2),
      originalPriceEur: (listing.originalPriceCents / 100).toFixed(2),
      currency: listing.currency,
      description: listing.description,
      sellerNameAnonymous: listing.sellerNameAnonymous,
      status: listing.status,
      createdAt: listing.createdAt,
      organization: listing.organization,
      timeLockActive: hoursUntilDeparture <= listing.organization.timeLockHours
    };

    res.json({ listing: publicListing });
  } catch (err) {
    console.error('Get listing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /listings ───
// Seller creates a listing (via widget or API)
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    const { error, value } = createListingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const orgId = req.organizationId;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    // Validate price bounds
    const minPrice = Math.floor(org.originalPriceCents * org.minPricePercent / 100);
    const maxPrice = Math.floor(org.originalPriceCents * org.maxPricePercent / 100);
    
    if (value.askingPriceCents < minPrice || value.askingPriceCents > maxPrice) {
      return res.status(400).json({ 
        error: `Price must be between ${org.minPricePercent}% and ${org.maxPricePercent}% of original price` 
      });
    }

    // Check time lock
    const hoursUntilDeparture = (new Date(value.departureDate) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilDeparture <= org.timeLockHours) {
      return res.status(400).json({ 
        error: `Transfers must be initiated at least ${org.timeLockHours} hours before departure` 
      });
    }

    // Hash email for privacy
    const emailHash = crypto.createHash('sha256').update(value.sellerEmail.toLowerCase()).digest('hex');
    
    // Create or find customer
    let customer = await prisma.customer.findUnique({
      where: { emailHash }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          email: value.sellerEmail, // Would be encrypted in production
          name: value.sellerName,
          phone: value.sellerPhone || null,
          emailHash,
          organizationId: orgId
        }
      });
    }

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        organizationId: orgId,
        originalBookingRef: value.originalBookingRef,
        destination: value.destination,
        departureDate: new Date(value.departureDate),
        returnDate: new Date(value.returnDate),
        originalPriceCents: value.originalPriceCents,
        askingPriceCents: value.askingPriceCents,
        currency: 'EUR',
        description: value.description || null,
        sellerNameAnonymous: value.sellerName.split(' ')[0] + '.', // e.g. "Thomas M."
        sellerEmailHash: emailHash,
        // Default expiration: 7 days
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      include: {
        organization: {
          select: {
            name: true,
            subdomain: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Listing created successfully',
      listing
    });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /listings/:id ───
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateListingSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { organization: true }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Only seller or org staff can update
    if (listing.sellerEmailHash !== req.user.emailHash && 
        listing.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Can only update ACTIVE listings
    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Can only update active listings' });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        askingPriceCents: value.askingPriceCents,
        description: value.description
      }
    });

    res.json({ listing: updated });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /listings/:id ───
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await prisma.listing.findUnique({ where: { id } });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Only seller or org staff can delete
    if (listing.sellerEmailHash !== req.user.emailHash && 
        listing.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Can only delete ACTIVE listings
    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Can only delete active listings' });
    }

    await prisma.listing.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({ message: 'Listing cancelled' });
  } catch (err) {
    console.error('Delete listing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /listings/my ───
// Get current user's listings (seller view)
router.get('/seller/my', authenticate, async (req, res) => {
  try {
    const emailHash = crypto.createHash('sha256')
      .update(req.user.email.toLowerCase()).digest('hex');

    const listings = await prisma.listing.findMany({
      where: { sellerEmailHash: emailHash },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ listings });
  } catch (err) {
    console.error('Get my listings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
