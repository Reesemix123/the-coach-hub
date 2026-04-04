/**
 * One-time script: Create Plus and Premium subscription prices
 * with correct amounts and tax_behavior: 'exclusive'
 *
 * Creates in both test and live mode (if live key provided).
 *
 * Usage:
 *   STRIPE_SECRET_KEY_LIVE=sk_live_... npx dotenv -e .env.local -- node scripts/create-subscription-prices.js
 */

const Stripe = require('stripe');

const testKey = process.env.STRIPE_SECRET_KEY;
const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;

if (!testKey) {
  console.error('STRIPE_SECRET_KEY is required in .env.local');
  process.exit(1);
}

const PRODUCTS = [
  {
    name: 'Youth Coach Hub — Plus',
    description: 'Plus plan: 4 games/month, 3 cameras, 180-day retention',
    prices: [
      { envVar: 'STRIPE_PRICE_PLUS_MONTHLY', amount: 2999, interval: 'month', label: 'Plus Monthly $29.99/mo' },
      { envVar: 'STRIPE_PRICE_PLUS_YEARLY', amount: 29999, interval: 'year', label: 'Plus Yearly $299.99/yr' },
    ],
  },
  {
    name: 'Youth Coach Hub — Premium',
    description: 'Premium plan: 8 games/month, 5 cameras, 365-day retention',
    prices: [
      { envVar: 'STRIPE_PRICE_PREMIUM_MONTHLY', amount: 7999, interval: 'month', label: 'Premium Monthly $79.99/mo' },
      { envVar: 'STRIPE_PRICE_PREMIUM_YEARLY', amount: 79999, interval: 'year', label: 'Premium Yearly $799.99/yr' },
    ],
  },
];

async function createOnAccount(stripe, mode) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Creating prices in ${mode.toUpperCase()} mode`);
  console.log(`${'='.repeat(60)}`);

  const results = [];

  for (const productDef of PRODUCTS) {
    // Create product
    const product = await stripe.products.create({
      name: productDef.name,
      description: productDef.description,
    });
    console.log(`\n  Product created: ${product.id} (${productDef.name})`);

    // Create prices on this product
    for (const priceDef of productDef.prices) {
      const price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: priceDef.amount,
        tax_behavior: 'exclusive',
        recurring: {
          interval: priceDef.interval,
          interval_count: 1,
        },
        metadata: {
          created_by: 'create-subscription-prices.js',
          created_at: new Date().toISOString(),
        },
      });

      const amountStr = `$${(priceDef.amount / 100).toFixed(2)}`;
      console.log(`    Price created: ${price.id} — ${amountStr}/${priceDef.interval}`);

      results.push({
        envVar: priceDef.envVar,
        label: priceDef.label,
        priceId: price.id,
        productId: product.id,
        amount: amountStr,
        interval: priceDef.interval,
        mode,
      });
    }
  }

  return results;
}

async function main() {
  console.log('Stripe Subscription Price Creator (LIVE MODE ONLY)');

  if (!liveKey) {
    console.error('STRIPE_SECRET_KEY_LIVE is required. Run with:');
    console.error('  STRIPE_SECRET_KEY_LIVE=sk_live_... npx dotenv -e .env.local -- node scripts/create-subscription-prices.js');
    process.exit(1);
  }

  console.log(`Live key: ${liveKey.substring(0, 8)}...`);

  const liveStripe = new Stripe(liveKey);
  const liveResults = await createOnAccount(liveStripe, 'live');
  const testResults = [];

  // Output mapping table
  console.log(`\n${'='.repeat(100)}`);
  console.log('RESULTS');
  console.log(`${'='.repeat(100)}\n`);

  console.log(
    'Env Var'.padEnd(38) +
    'Amount'.padEnd(14) +
    'Test Price ID'.padEnd(38) +
    'Live Price ID'
  );
  console.log('-'.repeat(100));

  for (const testRow of testResults) {
    const liveRow = liveResults.find(r => r.envVar === testRow.envVar);
    console.log(
      testRow.envVar.padEnd(38) +
      `${testRow.amount}/${testRow.interval}`.padEnd(14) +
      testRow.priceId.padEnd(38) +
      (liveRow ? liveRow.priceId : '(not created)')
    );
  }

  // Output env var blocks
  console.log(`\n${'='.repeat(100)}`);
  console.log('TEST MODE ENV VARS (for .env.local):');
  console.log(`${'='.repeat(100)}\n`);
  for (const r of testResults) {
    console.log(`${r.envVar}=${r.priceId}`);
  }

  if (liveResults.length > 0) {
    console.log(`\n${'='.repeat(100)}`);
    console.log('LIVE MODE ENV VARS (for Vercel production):');
    console.log(`${'='.repeat(100)}\n`);
    for (const r of liveResults) {
      console.log(`${r.envVar}=${r.priceId}`);
    }
  }

  console.log(`\nDone. ${testResults.length} test prices + ${liveResults.length} live prices created.`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
