import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import crypto from 'crypto';
import { authenticate, authenticateApiKey } from '../middleware/auth.js';
import { generateMapEmbed, generateGoogleMapsLink } from '../services/maps.js';

const router = Router();
const prisma = new PrismaClient();

// ─── Validation Schemas ───

// Full schema for admin submissions
const createListingSchema = Joi.object({
  originalBookingRef: Joi.string().required(),
  destination: Joi.string().min(2).max(200).required(),
  departureDate: Joi.date().optional(),
  returnDate: Joi.date().optional(),
  originalPriceCents: Joi.number().integer().min(1).required(),
  askingPriceCents: Joi.number().integer().min(1).required(),
  description: Joi.string().max(1000).allow('').optional(),
  
  // Seller info
  sellerName: Joi.string().min(2).max(50).required(),
  sellerEmail: Joi.string().email().required(),
  sellerPhone: Joi.string().max(20).allow('').optional(),
  sellerReason: Joi.string().max(500).allow('').optional(),
  
  // Flight details (required for admin, optional for seller)
  departureAirport: Joi.string().max(100).allow('').optional(),
  arrivalAirport: Joi.string().max(100).allow('').optional(),
  flightOutboundDate: Joi.date().optional(),
  flightOutboundTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow('').optional(),
  flightReturnDate: Joi.date().optional(),
  flightReturnTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow('').optional(),
  airline: Joi.string().max(100).allow('').optional(),
  flightNumber: Joi.string().max(20).allow('').optional(),
  baggage: Joi.string().max(100).allow('').optional(),
  
  // Hotel details
  hotelName: Joi.string().max(200).required(),
  hotelStars: Joi.number().integer().min(1).max(5).required(),
  hotelAddress: Joi.string().max(300).allow('').optional(),
  roomCategory: Joi.string().max(200).allow('').optional(),
  boardType: Joi.string().valid('AI', 'HP', 'BB', 'SC').allow('').optional(),
  
  // Transfer
  transferIncluded: Joi.boolean().default(false),
  transferType: Joi.string().valid('PRIVAT', 'SHUTTLE', 'SELBST').allow('').optional()
});

const updateListingSchema = Joi.object({
  // Basic
  originalBookingRef: Joi.string().max(50).optional(),
  destination: Joi.string().min(2).max(200).optional(),
  departureDate: Joi.date().optional(),
  returnDate: Joi.date().optional(),
  originalPriceCents: Joi.number().integer().min(1).optional(),
  askingPriceCents: Joi.number().integer().min(1).optional(),
  description: Joi.string().max(1000).allow('').optional(),
  sellerReason: Joi.string().max(500).allow('').optional(),
  
  // Hotel
  hotelName: Joi.string().max(200).optional(),
  hotelStars: Joi.number().integer().min(1).max(5).optional(),
  hotelStarsVerified: Joi.number().integer().min(1).max(5).optional(),
  hotelAddress: Joi.string().max(300).allow('').optional(),
  hotelMapEmbed: Joi.string().allow('').optional(),
  roomCategory: Joi.string().max(200).allow('').optional(),
  boardType: Joi.string().valid('AI', 'HP', 'BB', 'SC').allow('').optional(),
  
  // Flight
  departureAirport: Joi.string().max(100).allow('').optional(),
  arrivalAirport: Joi.string().max(100).allow('').optional(),
  flightOutboundDate: Joi.date().optional(),
  flightOutboundTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow('').optional(),
  flightReturnDate: Joi.date().optional(),
  flightReturnTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow('').optional(),
  airline: Joi.string().max(100).allow('').optional(),
  flightNumber: Joi.string().max(20).allow('').optional(),
  baggage: Joi.string().max(100).allow('').optional(),
  
  // Transfer
  transferIncluded: Joi.boolean().optional(),
  transferType: Joi.string().valid('PRIVAT', 'SHUTTLE', 'SELBST').allow('').optional(),
  
  // Admin status
  status: Joi.string().valid('ACTIVE', 'REJECTED', 'PENDING_APPROVAL').optional(),
  rejectionReason: Joi.string().max(500).optional()
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
      where.organization = { stripeOnboarded: true };
    }

    // Don't show listings about to expire or past time lock
    const now = new Date();
    where.departureDate = { gt: now };
    // Exclude expired listings (expiresAt is null OR expiresAt > now)
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: now } }
    ];

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
          sellerReason: true,
          status: true,
          createdAt: true,
          // Flight
          departureAirport: true,
          arrivalAirport: true,
          flightOutboundDate: true,
          flightOutboundTime: true,
          flightReturnDate: true,
          flightReturnTime: true,
          airline: true,
          flightNumber: true,
          baggage: true,
          // Hotel
          hotelName: true,
          hotelStars: true,
          hotelAddress: true,
          hotelMapEmbed: true,
          roomCategory: true,
          boardType: true,
          // Transfer
          transferIncluded: true,
          transferType: true,
          // Organization
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

    // Generate Google Maps links on-the-fly for listings without embed
    const listingsWithMaps = listings.map(l => ({
      ...l,
      googleMapsLink: l.hotelAddress ? generateGoogleMapsLink(l.hotelAddress) : null,
      boardTypeLabel: { AI: 'All Inclusive', HP: 'Halbpension', BB: 'Frühstück', SC: 'Selbstversorgung' }[l.boardType] || l.boardType,
      transferTypeLabel: { PRIVAT: 'Privater Transfer', SHUTTLE: 'Shuttle', SELBST: 'Eigene Anreise' }[l.transferType] || null
    }));

    res.json({
      listings: listingsWithMaps,
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
router.get('/:id', authenticate, async (req, res) => {
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
            timeLockHours: true
          }
        }
      }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check time lock (skip for authenticated admins)
    const now = new Date();
    const hoursUntilDeparture = (listing.departureDate - now) / (1000 * 60 * 60);
    
    if (!req.user && hoursUntilDeparture <= listing.organization.timeLockHours) {
      return res.status(410).json({ 
        error: 'Transfer period has ended',
        timeLockHours: listing.organization.timeLockHours
      });
    }

    const boardTypeLabels = { AI: 'All Inclusive', HP: 'Halbpension', BB: 'Frühstück', SC: 'Selbstversorgung' };
    const transferTypeLabels = { PRIVAT: 'Privater Transfer', SHUTTLE: 'Shuttle', SELBST: 'Eigene Anreise' };

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
      sellerReason: listing.sellerReason,
      // Flight
      departureAirport: listing.departureAirport,
      arrivalAirport: listing.arrivalAirport,
      flightOutboundDate: listing.flightOutboundDate,
      flightOutboundTime: listing.flightOutboundTime,
      flightReturnDate: listing.flightReturnDate,
      flightReturnTime: listing.flightReturnTime,
      airline: listing.airline,
      flightNumber: listing.flightNumber,
      baggage: listing.baggage,
      // Hotel
      hotelName: listing.hotelName,
      hotelStars: listing.hotelStars,
      hotelStarsVerified: listing.hotelStarsVerified,
      hotelAddress: listing.hotelAddress,
      hotelMapEmbed: listing.hotelMapEmbed,
      googleMapsLink: listing.hotelAddress ? generateGoogleMapsLink(listing.hotelAddress) : null,
      roomCategory: listing.roomCategory,
      boardType: listing.boardType,
      boardTypeLabel: boardTypeLabels[listing.boardType] || listing.boardType,
      // Transfer
      transferIncluded: listing.transferIncluded,
      transferType: listing.transferType,
      transferTypeLabel: listing.transferType ? transferTypeLabels[listing.transferType] : null,
      // Organization
      organization: {
        id: listing.organization.id,
        name: listing.organization.name,
        subdomain: listing.organization.subdomain,
        logoUrl: listing.organization.logoUrl
      },
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
    const minPrice = Math.floor(value.originalPriceCents * org.minPricePercent / 100);
    const maxPrice = Math.floor(value.originalPriceCents * org.maxPricePercent / 100);
    
    if (value.askingPriceCents < minPrice || value.askingPriceCents > maxPrice) {
      return res.status(400).json({ 
        error: `Preis muss zwischen ${org.minPricePercent}% und ${org.maxPricePercent}% des Originalpreises liegen` 
      });
    }

    // Check time lock (skip for seller submissions - they might be close to departure)
    // Admin submissions always check time lock
    const isAdminSubmission = !!req.user; // authenticateApiKey sets organizationId but not user
    if (isAdminSubmission) {
      const hoursUntilDeparture = (new Date(value.departureDate) - new Date()) / (1000 * 60 * 60);
      if (hoursUntilDeparture <= org.timeLockHours) {
        return res.status(400).json({ 
          error: `Transfers must be initiated at least ${org.timeLockHours} hours before departure` 
        });
      }
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
          email: value.sellerEmail,
          name: value.sellerName,
          phone: value.sellerPhone || null,
          emailHash,
          organizationId: orgId
        }
      });
    }

    // Auto-generate map embed from hotel address
    let hotelMapEmbed = null;
    if (value.hotelAddress) {
      try {
        hotelMapEmbed = await generateMapEmbed(value.hotelAddress);
      } catch (e) {
        console.warn('Could not generate map embed:', e);
      }
    }

    // Create listing as DRAFT or PENDING_APPROVAL based on org settings
    const listing = await prisma.listing.create({
      data: {
        organizationId: orgId,
        originalBookingRef: value.originalBookingRef,
        destination: value.destination,
        departureDate: value.departureDate ? new Date(value.departureDate) : undefined,
        returnDate: value.returnDate ? new Date(value.returnDate) : undefined,
        originalPriceCents: value.originalPriceCents,
        askingPriceCents: value.askingPriceCents,
        currency: 'EUR',
        description: value.description || null,
        sellerNameAnonymous: value.sellerName.split(' ')[0] + '.',
        sellerEmailHash: emailHash,
        sellerReason: value.sellerReason || null,
        // Status: auto-approve for now (can add admin approval later)
        status: 'PENDING_APPROVAL',
        // Flight (seller may not have these - admin fills in later)
        departureAirport: value.departureAirport || null,
        arrivalAirport: value.arrivalAirport || null,
        flightOutboundDate: value.flightOutboundDate ? new Date(value.flightOutboundDate) : null,
        flightOutboundTime: value.flightOutboundTime || null,
        flightReturnDate: value.flightReturnDate ? new Date(value.flightReturnDate) : null,
        flightReturnTime: value.flightReturnTime || null,
        airline: value.airline || null,
        flightNumber: value.flightNumber || null,
        baggage: value.baggage || null,
        // Hotel
        hotelName: value.hotelName,
        hotelStars: value.hotelStars,
        hotelAddress: value.hotelAddress || null,
        hotelMapEmbed: hotelMapEmbed,
        roomCategory: value.roomCategory || null,
        boardType: value.boardType || null,
        // Transfer
        transferIncluded: value.transferIncluded || false,
        transferType: value.transferType || null,
        // Default expiration: 14 days
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
    });

    res.status(201).json({
      message: 'Listing submitted for review',
      listing: { id: listing.id, status: listing.status }
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

    // Check authorization
    const isOrgStaff = listing.organizationId === req.user.organizationId;
    const isSeller = listing.sellerEmailHash === req.user.emailHash;
    
    if (!isOrgStaff && !isSeller) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Build update data
    const updateData = {};
    
    // Seller can update these
    if (isSeller && !isOrgStaff) {
      if (value.askingPriceCents) updateData.askingPriceCents = value.askingPriceCents;
      if (value.description !== undefined) updateData.description = value.description;
      if (value.sellerReason !== undefined) updateData.sellerReason = value.sellerReason;
    }
    
    // Admin can update ANY field
    if (isOrgStaff) {
      if (value.originalBookingRef !== undefined) updateData.originalBookingRef = value.originalBookingRef;
      if (value.destination !== undefined) updateData.destination = value.destination;
      if (value.departureDate !== undefined) updateData.departureDate = new Date(value.departureDate);
      if (value.returnDate !== undefined) updateData.returnDate = new Date(value.returnDate);
      if (value.originalPriceCents !== undefined) updateData.originalPriceCents = value.originalPriceCents;
      if (value.askingPriceCents !== undefined) updateData.askingPriceCents = value.askingPriceCents;
      if (value.description !== undefined) updateData.description = value.description;
      if (value.sellerReason !== undefined) updateData.sellerReason = value.sellerReason;
      // Hotel
      if (value.hotelName !== undefined) updateData.hotelName = value.hotelName;
      if (value.hotelStars !== undefined) updateData.hotelStars = value.hotelStars;
      if (value.hotelStarsVerified !== undefined) updateData.hotelStarsVerified = value.hotelStarsVerified;
      if (value.hotelAddress !== undefined) updateData.hotelAddress = value.hotelAddress || null;
      if (value.hotelMapEmbed !== undefined) updateData.hotelMapEmbed = value.hotelMapEmbed || null;
      if (value.roomCategory !== undefined) updateData.roomCategory = value.roomCategory || null;
      if (value.boardType !== undefined) updateData.boardType = value.boardType || null;
      // Flight
      if (value.departureAirport !== undefined) updateData.departureAirport = value.departureAirport || null;
      if (value.arrivalAirport !== undefined) updateData.arrivalAirport = value.arrivalAirport || null;
      if (value.flightOutboundDate !== undefined) updateData.flightOutboundDate = value.flightOutboundDate ? new Date(value.flightOutboundDate) : null;
      if (value.flightOutboundTime !== undefined) updateData.flightOutboundTime = value.flightOutboundTime || null;
      if (value.flightReturnDate !== undefined) updateData.flightReturnDate = value.flightReturnDate ? new Date(value.flightReturnDate) : null;
      if (value.flightReturnTime !== undefined) updateData.flightReturnTime = value.flightReturnTime || null;
      if (value.airline !== undefined) updateData.airline = value.airline || null;
      if (value.flightNumber !== undefined) updateData.flightNumber = value.flightNumber || null;
      if (value.baggage !== undefined) updateData.baggage = value.baggage || null;
      // Transfer
      if (value.transferIncluded !== undefined) updateData.transferIncluded = value.transferIncluded;
      if (value.transferType !== undefined) updateData.transferType = value.transferType || null;
      // Status
      if (value.status !== undefined) {
        updateData.status = value.status;
        if (value.status === 'REJECTED' && value.rejectionReason) {
          updateData.rejectionReason = value.rejectionReason;
        }
      }
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: updateData
    });

    res.json({ listing: updated });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /listings/:id/approve ───
// Admin approves a pending listing
router.post('/:id/approve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { organization: true }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (listing.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ error: 'Listing is not pending approval' });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: { status: 'ACTIVE' }
    });

    res.json({ message: 'Listing approved and now live', listing: { id: updated.id, status: updated.status } });
  } catch (err) {
    console.error('Approve listing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /listings/:id/reject ───
// Admin rejects a pending listing
router.post('/:id/reject', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { organization: true }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (listing.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ error: 'Listing is not pending approval' });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: { 
        status: 'REJECTED',
        rejectionReason: reason || 'No reason provided'
      }
    });

    res.json({ message: 'Listing rejected', listing: { id: updated.id, status: updated.status } });
  } catch (err) {
    console.error('Reject listing error:', err);
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

    if (listing.sellerEmailHash !== req.user.emailHash && 
        listing.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!['ACTIVE', 'PENDING_APPROVAL', 'DRAFT'].includes(listing.status)) {
      return res.status(400).json({ error: 'Cannot cancel this listing' });
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
