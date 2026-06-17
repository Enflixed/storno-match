import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16'
});

// ─── Create Payment Intent ───
export async function createPaymentIntent({
  amount,
  currency = 'eur',
  organizationId,
  listingId,
  buyerEmail,
  metadata = {}
}) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: {
      enabled: true
    },
    metadata: {
      organizationId,
      listingId,
      buyerEmail,
      platform: 'storno_match',
      ...metadata
    },
    // For demo: use platform account
    // In production with Connect, this would be the connected account
    transfer_data: {
      // Will be set when creating Connect accounts per organization
      destination: process.env.STRIPE_PLATFORM_ACCOUNT_ID
    },
    application_fee_amount: Math.round(amount * 0.03) // 3% platform fee
  });

  return paymentIntent;
}

// ─── Create Transfer to Seller ───
export async function createTransfer({
  amount,
  currency = 'eur',
  destinationAccountId,
  metadata = {}
}) {
  const transfer = await stripe.transfers.create({
    amount,
    currency,
    destination: destinationAccountId,
    metadata: {
      platform: 'storno_match',
      ...metadata
    }
  });

  return transfer;
}

// ─── Create Connect Account for Organization ───
export async function createConnectAccount(organization, email) {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    metadata: {
      organizationId: organization.id,
      organizationName: organization.name
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    }
  });

  return account;
}

// ─── Create Account Link for Onboarding ───
export async function createAccountLink(accountId, refreshUrl, returnUrl) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding'
  });

  return accountLink;
}

// ─── Get Connect Account Status ───
export async function getConnectAccountStatus(accountId) {
  const account = await stripe.accounts.retrieve(accountId);
  
  return {
    id: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted
  };
}

// ─── Refund Payment ───
export async function refundPayment(paymentIntentId, amount = null) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount // If null, refunds full amount
  });

  return refund;
}

// ─── Construct Webhook Event ───
export function constructWebhookEvent(payload, signature, webhookSecret) {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export default stripe;
