// src/lib/stripe/client.ts
// Stripe client configuration and utility functions

import Stripe from 'stripe';
import { SubscriptionTier } from '@/types/admin';

// =============================================================================
// STRIPE PRODUCT IDS (for reference - actual checkout uses Price IDs)
// =============================================================================
export const STRIPE_PRODUCT_IDS = {
  // Subscription products (3 tiers: basic is free, plus and premium are paid)
  plus: 'prod_TY6uP1VMleLZBG',
  premium: 'prod_TY6w1hsD5lYjLa',
} as const;

// =============================================================================
// PRICING CONFIGURATION
// =============================================================================
export type BillingCycle = 'monthly' | 'yearly';

// =============================================================================
// STRIPE CLIENT
// =============================================================================

// Initialize Stripe client (server-side only)
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  return new Stripe(secretKey, {
    apiVersion: '2025-04-30.basil',
    typescript: true
  });
}

// =============================================================================
// SUBSCRIPTION PRICE MAPPING
// =============================================================================

// Get price ID for a subscription tier with billing cycle
export function getPriceIdForTier(
  tier: SubscriptionTier,
  billingCycle: BillingCycle = 'monthly'
): string | null {
  // Basic tier is free, no Stripe price
  if (tier === 'basic') {
    return null;
  }

  const priceMap: Record<Exclude<SubscriptionTier, 'basic'>, { monthly?: string; yearly?: string }> = {
    'plus': {
      monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PLUS_YEARLY
    },
    'premium': {
      monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY
    }
  };

  return priceMap[tier]?.[billingCycle] || null;
}

// Map Stripe price IDs back to tiers (checks all billing cycles)
export function getTierFromPriceId(priceId: string): SubscriptionTier | null {
  const tierMap: Record<string, SubscriptionTier> = {};

  // Monthly prices
  if (process.env.STRIPE_PRICE_PLUS_MONTHLY) {
    tierMap[process.env.STRIPE_PRICE_PLUS_MONTHLY] = 'plus';
  }
  if (process.env.STRIPE_PRICE_PREMIUM_MONTHLY) {
    tierMap[process.env.STRIPE_PRICE_PREMIUM_MONTHLY] = 'premium';
  }

  // Yearly prices
  if (process.env.STRIPE_PRICE_PLUS_YEARLY) {
    tierMap[process.env.STRIPE_PRICE_PLUS_YEARLY] = 'plus';
  }
  if (process.env.STRIPE_PRICE_PREMIUM_YEARLY) {
    tierMap[process.env.STRIPE_PRICE_PREMIUM_YEARLY] = 'premium';
  }

  return tierMap[priceId] || null;
}

// Get billing cycle from price ID
export function getBillingCycleFromPriceId(priceId: string): BillingCycle | null {
  const monthlyPrices = [
    process.env.STRIPE_PRICE_PLUS_MONTHLY,
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY
  ].filter(Boolean);

  const yearlyPrices = [
    process.env.STRIPE_PRICE_PLUS_YEARLY,
    process.env.STRIPE_PRICE_PREMIUM_YEARLY
  ].filter(Boolean);

  if (monthlyPrices.includes(priceId)) return 'monthly';
  if (yearlyPrices.includes(priceId)) return 'yearly';
  return null;
}

// =============================================================================
// STATUS MAPPING
// =============================================================================

// Map Stripe subscription status to our status
export function mapStripeStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    'trialing': 'trialing',
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'past_due',
    'incomplete': 'none',
    'incomplete_expired': 'canceled',
    'paused': 'past_due'
  };

  return statusMap[stripeStatus] || 'active';
}

// =============================================================================
// CONFIGURATION HELPERS
// =============================================================================

// Check if Stripe is properly configured
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

// Check if subscription prices are configured
export function areSubscriptionPricesConfigured(): boolean {
  // At minimum, we need Plus tier prices configured
  return !!(
    process.env.STRIPE_PRICE_PLUS_MONTHLY ||
    process.env.STRIPE_PRICE_PLUS_YEARLY
  );
}

// Get the app URL for redirects
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ||
         process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
         'http://localhost:3000';
}

// =============================================================================
// WEBHOOK URL HELPER
// =============================================================================

// Get the webhook URL for configuring in Stripe Dashboard
export function getWebhookUrl(): string {
  const appUrl = getAppUrl();
  return `${appUrl}/api/webhooks/stripe`;
}
