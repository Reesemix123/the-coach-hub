// src/lib/stripe/client.ts
// Stripe client configuration and utility functions

import Stripe from 'stripe';
import { SubscriptionTier } from '@/types/admin';

// =============================================================================
// STRIPE PRODUCT IDS (for reference - actual checkout uses Price IDs)
// =============================================================================
export const STRIPE_PRODUCT_IDS = {
  // Subscription products
  plus: 'prod_TY6uP1VMleLZBG',
  premium: 'prod_TY6w1hsD5lYjLa',
  ai_powered: 'prod_TY6yhcO3ZM4060',
  // One-time purchase products (extra video minutes)
  minutes_15: 'prod_TY71D0kW83GrZ4',
  minutes_30: 'prod_TY74MlwZPonHsm',
  minutes_60: 'prod_TY74xr7XXqMM3u',
  minutes_120: 'prod_TY75NAb59zPP89'
} as const;

// =============================================================================
// PRICING CONFIGURATION
// =============================================================================
export type BillingCycle = 'monthly' | 'yearly';

export interface ExtraMinutesPack {
  minutes: number;
  price: number; // in dollars
  pricePerMinute: number;
  expirationDays: number;
}

// Extra video minutes packs configuration
export const EXTRA_MINUTES_PACKS: ExtraMinutesPack[] = [
  { minutes: 15, price: 15, pricePerMinute: 1.00, expirationDays: 90 },
  { minutes: 30, price: 25, pricePerMinute: 0.83, expirationDays: 90 },
  { minutes: 60, price: 45, pricePerMinute: 0.75, expirationDays: 90 },
  { minutes: 120, price: 79, pricePerMinute: 0.66, expirationDays: 90 }
];

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
    },
    'ai_powered': {
      monthly: process.env.STRIPE_PRICE_AI_POWERED_MONTHLY,
      yearly: process.env.STRIPE_PRICE_AI_POWERED_YEARLY
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
  if (process.env.STRIPE_PRICE_AI_POWERED_MONTHLY) {
    tierMap[process.env.STRIPE_PRICE_AI_POWERED_MONTHLY] = 'ai_powered';
  }

  // Yearly prices
  if (process.env.STRIPE_PRICE_PLUS_YEARLY) {
    tierMap[process.env.STRIPE_PRICE_PLUS_YEARLY] = 'plus';
  }
  if (process.env.STRIPE_PRICE_PREMIUM_YEARLY) {
    tierMap[process.env.STRIPE_PRICE_PREMIUM_YEARLY] = 'premium';
  }
  if (process.env.STRIPE_PRICE_AI_POWERED_YEARLY) {
    tierMap[process.env.STRIPE_PRICE_AI_POWERED_YEARLY] = 'ai_powered';
  }

  return tierMap[priceId] || null;
}

// Get billing cycle from price ID
export function getBillingCycleFromPriceId(priceId: string): BillingCycle | null {
  const monthlyPrices = [
    process.env.STRIPE_PRICE_PLUS_MONTHLY,
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
    process.env.STRIPE_PRICE_AI_POWERED_MONTHLY
  ].filter(Boolean);

  const yearlyPrices = [
    process.env.STRIPE_PRICE_PLUS_YEARLY,
    process.env.STRIPE_PRICE_PREMIUM_YEARLY,
    process.env.STRIPE_PRICE_AI_POWERED_YEARLY
  ].filter(Boolean);

  if (monthlyPrices.includes(priceId)) return 'monthly';
  if (yearlyPrices.includes(priceId)) return 'yearly';
  return null;
}

// =============================================================================
// ONE-TIME PURCHASE (EXTRA MINUTES) PRICE MAPPING
// =============================================================================

// Get price ID for extra video minutes pack
export function getPriceIdForMinutesPack(minutes: number): string | null {
  const priceMap: Record<number, string | undefined> = {
    15: process.env.STRIPE_PRICE_MINUTES_15,
    30: process.env.STRIPE_PRICE_MINUTES_30,
    60: process.env.STRIPE_PRICE_MINUTES_60,
    120: process.env.STRIPE_PRICE_MINUTES_120
  };

  return priceMap[minutes] || null;
}

// Get minutes from price ID (for one-time purchases)
export function getMinutesFromPriceId(priceId: string): number | null {
  const minutesMap: Record<string, number> = {};

  if (process.env.STRIPE_PRICE_MINUTES_15) {
    minutesMap[process.env.STRIPE_PRICE_MINUTES_15] = 15;
  }
  if (process.env.STRIPE_PRICE_MINUTES_30) {
    minutesMap[process.env.STRIPE_PRICE_MINUTES_30] = 30;
  }
  if (process.env.STRIPE_PRICE_MINUTES_60) {
    minutesMap[process.env.STRIPE_PRICE_MINUTES_60] = 60;
  }
  if (process.env.STRIPE_PRICE_MINUTES_120) {
    minutesMap[process.env.STRIPE_PRICE_MINUTES_120] = 120;
  }

  return minutesMap[priceId] || null;
}

// Check if a price ID is for a one-time minutes purchase
export function isMinutesPurchasePriceId(priceId: string): boolean {
  return getMinutesFromPriceId(priceId) !== null;
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

// Check if one-time purchase prices are configured
export function areMinutesPricesConfigured(): boolean {
  return !!(
    process.env.STRIPE_PRICE_MINUTES_15 ||
    process.env.STRIPE_PRICE_MINUTES_30 ||
    process.env.STRIPE_PRICE_MINUTES_60 ||
    process.env.STRIPE_PRICE_MINUTES_120
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
