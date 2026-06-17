import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { constructWebhookEvent } from '../services/stripe.js';

const router = Router();
const prisma = new PrismaClient();

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ─── POST /webhooks/stripe ───
router.post('/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature'];

  let event;

  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = constructWebhookEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } else {
      // Development without webhook signature verification
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  // Log the event
  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      stripeEventId: event.id,
      type: event.type,
      payload: event,
      processed: false
    }
  });

  try {
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;

      case 'transfer.created':
        console.log('Transfer created:', event.data.object.id);
        break;

      case 'transfer.failed':
        console.log('Transfer failed:', event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true, processedAt: new Date() }
    });

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    
    // Mark as failed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { error: err.message }
    });

    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─── Payment Intent Succeeded ───
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);

  const listingId = paymentIntent.metadata.listingId;
  
  if (!listingId) return;

  // Find pending transfer
  const transfer = await prisma.transfer.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id,
      status: 'PENDING'
    },
    include: {
      listing: true,
      organization: true
    }
  });

  if (!transfer) {
    console.warn('No pending transfer found for payment intent:', paymentIntent.id);
    return;
  }

  // Update transfer
  await prisma.transfer.update({
    where: { id: transfer.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      stripeChargeId: paymentIntent.latest_charge
    }
  });

  // Update listing
  await prisma.listing.update({
    where: { id: listingId },
    data: { status: 'SOLD' }
  });

  console.log(`Transfer ${transfer.id} marked as PAID`);
}

// ─── Payment Intent Failed ───
async function handlePaymentIntentFailed(paymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  const listingId = paymentIntent.metadata.listingId;
  
  if (!listingId) return;

  // Find pending transfer
  const transfer = await prisma.transfer.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id,
      status: 'PENDING'
    }
  });

  if (!transfer) return;

  // Mark as cancelled
  await prisma.transfer.update({
    where: { id: transfer.id },
    data: { status: 'CANCELLED' }
  });

  // Reset listing to active
  await prisma.listing.update({
    where: { id: listingId },
    data: { status: 'ACTIVE' }
  });
}

// ─── Account Updated (Connect) ───
async function handleAccountUpdated(account) {
  const organizationId = account.metadata?.organizationId;
  
  if (!organizationId) return;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!organization) return;

  // Update Stripe onboarding status
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      stripeOnboarded: account.charges_enabled && account.payouts_enabled,
      stripeAccountId: account.id
    }
  });

  console.log(`Organization ${organizationId} Stripe status updated`);
}

export default router;
