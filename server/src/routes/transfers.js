import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { authenticate, authenticateApiKey } from '../middleware/auth.js';
import { createPaymentIntent, createTransfer, refundPayment } from '../services/stripe.js';

const router = Router();
const prisma = new PrismaClient();

const PLATFORM_FEE_CENTS = 3900;

// ─── POST /transfers ───
// Buyer initiates purchase
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    const {
      listingId,
      // Buyer required fields
      buyerSalutation,   // 'male' | 'female' | 'diverse'
      buyerFirstName,
      buyerLastName,
      buyerBirthDate,
      buyerEmail,
      buyerPhone,
      buyerNationality,
      // Optional
      buyerTitle,
      buyerBirthPlace,
      buyerStreet,
      buyerHouseNumber,
      buyerPostalCode,
      buyerCity,
      buyerCountry
    } = req.body;

    if (!listingId || !buyerFirstName || !buyerLastName || !buyerEmail || !buyerBirthDate) {
      return res.status(400).json({ error: 'Missing required buyer fields: firstName, lastName, email, birthDate' });
    }

    // Get listing
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { organization: true }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Listing is not available' });
    }

    // Check time lock
    const now = new Date();
    const hoursUntilDeparture = (listing.departureDate - now) / (1000 * 60 * 60);
    
    if (hoursUntilDeparture <= listing.organization.timeLockHours) {
      return res.status(400).json({ error: 'Transfer period has ended' });
    }

    if (listing.expiresAt && new Date(listing.expiresAt) < now) {
      return res.status(400).json({ error: 'Listing has expired' });
    }

    // Hash email for privacy
    const buyerEmailHash = crypto.createHash('sha256')
      .update(buyerEmail.toLowerCase()).digest('hex');

    // Upsert buyer customer with ALL fields
    let buyer = await prisma.customer.findUnique({ where: { emailHash: buyerEmailHash } });
    
    if (buyer) {
      // Update with new data
      buyer = await prisma.customer.update({
        where: { id: buyer.id },
        data: {
          firstName: buyerFirstName,
          lastName: buyerLastName,
          gender: buyerSalutation || null,
          birthDate: buyerBirthDate ? new Date(buyerBirthDate) : null,
          birthPlace: buyerBirthPlace || null,
          title: buyerTitle || null,
          street: buyerStreet || null,
          houseNumber: buyerHouseNumber || null,
          postalCode: buyerPostalCode || null,
          city: buyerCity || null,
          country: buyerCountry || null,
          nationality: buyerNationality || null,
          phone: buyerPhone || null
        }
      });
    } else {
      buyer = await prisma.customer.create({
        data: {
          email: buyerEmail,
          name: `${buyerFirstName} ${buyerLastName}`,
          phone: buyerPhone || null,
          emailHash: buyerEmailHash,
          organizationId: listing.organizationId,
          gender: buyerSalutation || null,
          firstName: buyerFirstName,
          lastName: buyerLastName,
          birthDate: new Date(buyerBirthDate),
          birthPlace: buyerBirthPlace || null,
          title: buyerTitle || null,
          street: buyerStreet || null,
          houseNumber: buyerHouseNumber || null,
          postalCode: buyerPostalCode || null,
          city: buyerCity || null,
          country: buyerCountry || null,
          nationality: buyerNationality || null
        }
      });
    }

    // Calculate fees
    const amountCents = listing.askingPriceCents;
    const creatorRoyaltyCents = Math.round(amountCents * 0.05);
    const sellerPayoutCents = amountCents - PLATFORM_FEE_CENTS - creatorRoyaltyCents;

    // Create Stripe Payment Intent
    let paymentIntent;
    if (process.env.DEMO_MODE === 'true') {
      paymentIntent = {
        id: 'pi_demo_' + crypto.randomBytes(8).toString('hex'),
        client_secret: 'demo_secret_' + crypto.randomBytes(8).toString('hex'),
        status: 'succeeded'
      };
    } else {
      paymentIntent = await createPaymentIntent({
        amount: amountCents,
        currency: 'eur',
        organizationId: listing.organizationId,
        listingId: listing.id,
        buyerEmail,
        metadata: {
          listingId: listing.id,
          buyerEmailHash,
          sellerEmailHash: listing.sellerEmailHash,
          organizationId: listing.organizationId
        }
      });
    }

    // ─── ATOMIC: Reserve listing with race condition protection ───
    const listingUpdate = await prisma.listing.updateMany({
      where: {
        id: listingId,
        status: 'ACTIVE'
      },
      data: {
        status: 'PENDING',
        stripePaymentIntentId: paymentIntent.id
      }
    });

    if (listingUpdate.count === 0) {
      return res.status(409).json({ error: 'Listing was purchased by another buyer' });
    }
    // ────────────────────────────────────────────────────────────────

    // Look up seller
    const seller = await prisma.customer.findUnique({
      where: { emailHash: listing.sellerEmailHash }
    });

    // Create transfer record (PENDING)
    const transfer = await prisma.transfer.create({
      data: {
        listingId: listing.id,
        organizationId: listing.organizationId,
        sellerId: seller?.id || 'unknown',
        sellerCustomerId: seller?.id || 'unknown',
        sellerEmailHash: listing.sellerEmailHash,
        buyerId: buyer.id,
        buyerCustomerId: buyer.id,
        buyerEmailHash,
        amountCents,
        currency: 'EUR',
        platformFeeCents: PLATFORM_FEE_CENTS,
        creatorRoyaltyCents,
        sellerPayoutCents,
        stripePaymentIntentId: paymentIntent.id,
        status: 'PENDING'
      }
    });

    res.status(201).json({
      message: 'Transfer initiated',
      transfer: {
        id: transfer.id,
        amountCents,
        amountEur: (amountCents / 100).toFixed(2),
        platformFeeCents: PLATFORM_FEE_CENTS,
        sellerPayoutCents,
        currency: 'EUR'
      },
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error('Create transfer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /transfers/:id ───
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            destination: true,
            departureDate: true,
            originalBookingRef: true
          }
        }
      }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get full buyer data (PRIVATE - admin only)
    const buyer = await prisma.customer.findUnique({
      where: { id: transfer.buyerCustomerId }
    });

    const seller = await prisma.customer.findUnique({
      where: { id: transfer.sellerCustomerId }
    });

    res.json({
      transfer: {
        ...transfer,
        // FULL buyer data - only visible to admin
        buyer: buyer ? {
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          title: buyer.title,
          gender: buyer.gender,
          birthDate: buyer.birthDate,
          birthPlace: buyer.birthPlace,
          nationality: buyer.nationality,
          street: buyer.street,
          houseNumber: buyer.houseNumber,
          postalCode: buyer.postalCode,
          city: buyer.city,
          country: buyer.country,
          email: buyer.email,
          phone: buyer.phone
        } : null,
        // Seller full data
        seller: seller ? {
          firstName: seller.firstName,
          lastName: seller.lastName
        } : null
      }
    });
  } catch (err) {
    console.error('Get transfer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /transfers ───
// List transfers (org staff view)
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const where = {
      organizationId: req.user.organizationId
    };

    if (status) {
      where.status = status;
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        take: parseInt(limit),
        skip: parseInt(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: {
              destination: true,
              departureDate: true,
              originalBookingRef: true,
              askingPriceCents: true
            }
          },
          buyerCustomer: {
            select: {
              firstName: true,
              lastName: true
              // NO email or sensitive fields in public list view
            }
          },
          sellerCustomer: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      prisma.transfer.count({ where })
    ]);

    res.json({
      transfers: transfers.map(t => ({
        id: t.id,
        status: t.status,
        amountCents: t.amountCents,
        currency: t.currency,
        paidAt: t.paidAt,
        completedAt: t.completedAt,
        createdAt: t.createdAt,
        listing: t.listing,
        buyer: {
          firstName: t.buyerCustomer?.firstName,
          lastName: t.buyerCustomer?.lastName,
          email: t.buyerCustomer?.email
        },
        seller: {
          firstName: t.sellerCustomer?.firstName,
          lastName: t.sellerCustomer?.lastName
        }
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + transfers.length < total
      }
    });
  } catch (err) {
    console.error('List transfers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /transfers/:id/complete ───
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: { organization: true }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (transfer.status !== 'PAID') {
      return res.status(400).json({ error: 'Transfer must be paid first' });
    }

    // Create payout to seller via Stripe
    let payout;
    if (process.env.DEMO_MODE === 'true') {
      payout = { id: 'po_demo_' + crypto.randomBytes(8).toString('hex') };
    } else {
      payout = await createTransfer({
        amount: transfer.sellerPayoutCents,
        currency: 'eur',
        destinationAccountId: transfer.organization.stripeAccountId,
        metadata: {
          transferId: transfer.id,
          type: 'seller_payout'
        }
      });
    }

    await prisma.transfer.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        reassignmentStatus: 'COMPLETED',
        reassignmentNotes: notes || null,
        stripeTransferId: payout.id,
        completedAt: new Date()
      }
    });

    res.json({ 
      message: 'Transfer completed successfully',
      status: 'COMPLETED',
      sellerPayoutId: payout.id
    });
  } catch (err) {
    console.error('Complete transfer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /transfers/:id/confirm-payment ───
// Buyer confirms they have paid (demo flow)
router.post('/:id/confirm-payment', async (req, res) => {
  try {
    const { id } = req.params;

    const transfer = await prisma.transfer.findUnique({
      where: { id }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Transfer is not pending payment' });
    }

    const updated = await prisma.transfer.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date()
      }
    });

    // Also update listing status
    await prisma.listing.update({
      where: { id: transfer.listingId },
      data: { status: 'SOLD' }
    });

    res.json({ 
      message: 'Payment confirmed',
      transfer: { id: updated.id, status: updated.status }
    });
  } catch (err) {
    console.error('Confirm payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /transfers/:id/reject ───
router.post('/:id/reject', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: { organization: true }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!['PENDING', 'PAID'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Cannot reject this transfer' });
    }

    // Refund if paid
    if (transfer.status === 'PAID' && transfer.stripePaymentIntentId) {
      if (process.env.DEMO_MODE !== 'true') {
        await refundPayment(transfer.stripePaymentIntentId);
      }
    }

    const [updatedTransfer] = await Promise.all([
      prisma.transfer.update({
        where: { id },
        data: {
          status: 'REFUNDED',
          reassignmentStatus: 'REJECTED',
          reassignmentNotes: reason || null,
          refundedAt: new Date()
        }
      }),
      prisma.listing.update({
        where: { id: transfer.listingId },
        data: {
          status: 'ACTIVE',
          stripePaymentIntentId: null
        }
      })
    ]);

    res.json({ 
      message: 'Transfer rejected and refund initiated',
      transfer: { id: updatedTransfer.id, status: updatedTransfer.status }
    });
  } catch (err) {
    console.error('Reject transfer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /transfers/:id/confirm-seller ───
// Seller confirms the reassignment
router.post('/:id/confirm-seller', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const transfer = await prisma.transfer.findUnique({
      where: { id }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.sellerEmailHash !== req.user.emailHash) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (transfer.status !== 'PAID') {
      return res.status(400).json({ error: 'Transfer must be paid first' });
    }

    const updated = await prisma.transfer.update({
      where: { id },
      data: {
        reassignmentStatus: 'IN_PROGRESS',
        reassignmentNotes: notes || null
      }
    });

    res.json({ 
      message: 'Reassignment confirmed by seller',
      transfer: { id: updated.id, reassignmentStatus: updated.reassignmentStatus }
    });
  } catch (err) {
    console.error('Confirm seller error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
