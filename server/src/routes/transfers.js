import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { authenticate, authenticateApiKey } from '../middleware/auth.js';
import { createPaymentIntent, createTransfer, refundPayment } from '../services/stripe.js';
import { sendNotification } from '../services/email.js';

const router = Router();
const prisma = new PrismaClient();

// Platform fee: €39 fixed
const PLATFORM_FEE_CENTS = 3900;

// ─── POST /transfers ───
// Buyer initiates purchase
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    const { listingId, buyerName, buyerEmail, buyerPhone } = req.body;

    if (!listingId || !buyerName || !buyerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
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
      return res.status(400).json({ 
        error: 'Transfer period has ended' 
      });
    }

    // Check expiration
    if (listing.expiresAt && new Date(listing.expiresAt) < now) {
      return res.status(400).json({ error: 'Listing has expired' });
    }

    // Create or find buyer customer
    const buyerEmailHash = crypto.createHash('sha256')
      .update(buyerEmail.toLowerCase()).digest('hex');

    let buyer = await prisma.customer.findUnique({ where: { emailHash: buyerEmailHash } });
    
    if (!buyer) {
      buyer = await prisma.customer.create({
        data: {
          email: buyerEmail,
          name: buyerName,
          phone: buyerPhone || null,
          emailHash: buyerEmailHash,
          organizationId: listing.organizationId
        }
      });
    }

    // Calculate fees
    const amountCents = listing.askingPriceCents;
    const creatorRoyaltyCents = Math.round(amountCents * 0.05); // 5% optional royalty
    const sellerPayoutCents = amountCents - PLATFORM_FEE_CENTS;

    // Create Stripe Payment Intent
    const paymentIntent = await createPaymentIntent({
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

    // Create transfer record (PENDING)
    const transfer = await prisma.transfer.create({
      data: {
        listingId: listing.id,
        organizationId: listing.organizationId,
        sellerId: 'pending', // Will be updated
        sellerCustomerId: 'pending',
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

    // Update listing status
    await prisma.listing.update({
      where: { id: listingId },
      data: { 
        status: 'PENDING',
        stripePaymentIntentId: paymentIntent.id
      }
    });

    res.status(201).json({
      message: 'Transfer initiated',
      transfer: {
        id: transfer.id,
        amountCents,
        amountEur: (amountCents / 100).toFixed(2),
        platformFeeCents,
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

// ─── POST /transfers/:id/confirm-payment ───
// Stripe webhook calls this after successful payment
router.post('/:id/confirm-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentIntentId } = req.body;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: { 
        listing: true,
        organization: true 
      }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.stripePaymentIntentId !== paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent mismatch' });
    }

    // Update transfer status
    await prisma.transfer.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date()
      }
    });

    // Update listing status
    await prisma.listing.update({
      where: { id: transfer.listingId },
      data: { status: 'SOLD' }
    });

    // Notify travel agency
    await sendNotification({
      to: transfer.organization.contactEmail,
      template: 'transfer_received',
      data: {
        organizationName: transfer.organization.name,
        destination: transfer.listing.destination,
        departureDate: transfer.listing.departureDate,
        amountEur: (transfer.amountCents / 100).toFixed(2),
        transferId: transfer.id
      }
    });

    // Notify seller
    // In production, would send email to the seller

    res.json({ message: 'Payment confirmed', status: 'PAID' });
  } catch (err) {
    console.error('Confirm payment error:', err);
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
            returnDate: true,
            originalBookingRef: true
          }
        },
        organization: {
          select: {
            name: true,
            subdomain: true
          }
        }
      }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    // Check authorization
    if (transfer.organizationId !== req.user.organizationId && 
        transfer.sellerEmailHash !== req.user.emailHash &&
        transfer.buyerEmailHash !== req.user.emailHash) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({ transfer });
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
              departureDate: true
            }
          }
        }
      }),
      prisma.transfer.count({ where })
    ]);

    res.json({
      transfers,
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
// Travel agency completes the reassignment
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
    const payout = await createTransfer({
      amount: transfer.sellerPayoutCents,
      currency: 'eur',
      destinationAccountId: transfer.organization.stripeAccountId,
      metadata: {
        transferId: transfer.id,
        type: 'seller_payout'
      }
    });

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

    // Notify buyer their booking is confirmed
    // In production, would send confirmation email

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

// ─── POST /transfers/:id/reject ───
// Travel agency rejects the transfer
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

    if (transfer.status !== 'PAID') {
      return res.status(400).json({ error: 'Transfer must be paid first' });
    }

    // Refund buyer
    await refundPayment(transfer.stripePaymentIntentId);

    await prisma.transfer.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        reassignmentStatus: 'REJECTED',
        reassignmentNotes: reason || 'Rejected by travel agency',
        refundedAt: new Date()
      }
    });

    // Reset listing
    await prisma.listing.update({
      where: { id: transfer.listingId },
      data: { status: 'ACTIVE' }
    });

    res.json({ 
      message: 'Transfer rejected, buyer refunded',
      status: 'REFUNDED'
    });
  } catch (err) {
    console.error('Reject transfer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
