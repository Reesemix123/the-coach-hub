// src/lib/stripe/client.ts
// Stripe client configuration and utility functions

import Stripe from 'stripe';
import { SubscriptionTier } from '@/types/admin';

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

// Map subscription tiers to Stripe price IDs
export function getPriceIdForTier(tier: SubscriptionTier): string | null {
  const priceMap: Record<SubscriptionTier, string | undefined> = {
    'little_league': process.env.STRIPE_PRICE_LITTLE_LEAGUE,
    'hs_basic': process.env.STRIPE_PRICE_HS_BASIC,
    'hs_advanced': process.env.STRIPE_PRICE_HS_ADVANCED,
    'ai_powered': process.env.STRIPE_PRICE_AI_POWERED
  };

  return priceMap[tier] || null;
}

// Map Stripe price IDs back to tiers
export function getTierFromPriceId(priceId: string): SubscriptionTier | null {
  const tierMap: Record<string, SubscriptionTier> = {};

  if (process.env.STRIPE_PRICE_LITTLE_LEAGUE) {
    tierMap[process.env.STRIPE_PRICE_LITTLE_LEAGUE] = 'little_league';
  }
  if (process.env.STRIPE_PRICE_HS_BASIC) {
    tierMap[process.env.STRIPE_PRICE_HS_BASIC] = 'hs_basic';
  }
  if (process.env.STRIPE_PRICE_HS_ADVANCED) {
    tierMap[process.env.STRIPE_PRICE_HS_ADVANCED] = 'hs_advanced';
  }
  if (process.env.STRIPE_PRICE_AI_POWERED) {
    tierMap[process.env.STRIPE_PRICE_AI_POWERED] = 'ai_powered';
  }

  return tierMap[priceId] || null;
}

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

// Check if Stripe is properly configured
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

// Get the app URL for redirects
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ||
         process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
         'http://localhost:3000';
}
