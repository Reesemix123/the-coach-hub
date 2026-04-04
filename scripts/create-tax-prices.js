/**
 * One-time migration script: Create new Stripe prices with tax_behavior: 'exclusive'
 *
 * For each of the 11 price env vars:
 * 1. Try to fetch the price from test mode
 * 2. If not found, fetch from live mode to get configuration
 * 3. Ensure the product exists in test mode (create if needed)
 * 4. Create a new price with identical config + tax_behavior: 'exclusive'
 *
 * Usage:
 *   npx dotenv -e .env.local -- node scripts/create-tax-prices.js
 *
 * If prices only exist in live mode, also set STRIPE_SECRET_KEY_LIVE:
 *   STRIPE_SECRET_KEY_LIVE=sk_live_... npx dotenv -e .env.local -- node scripts/create-tax-prices.js
 *
 * This script does NOT modify existing prices or env vars.
 * Review the output table and manually update .env.local and Vercel.
 */

const Stripe = require('stripe');

const testKey = process.env.STRIPE_SECRET_KEY;
const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;

if (!testKey) {
  console.error('STRIPE_SECRET_KEY is required');
  process.exit(1);
}

if (!liveKey) {
  console.error('STRIPE_SECRET_KEY_LIVE is required. Run with:');
  console.error('  STRIPE_SECRET_KEY_LIVE=sk_live_... npx dotenv -e .env.local -- node scripts/create-tax-prices.js');
  process.exit(1);
}

const liveStripe = new Stripe(liveKey);

// 7 remaining prices — hardcoded original LIVE price IDs as source
// (env vars now point to test mode, so we use the original live IDs directly)
const PRICE_VARS = [
  { envVar: 'STRIPE_PRICE_TOKEN_SINGLE', desc: 'Upload Token', livePriceId: 'price_1SkzZuLFq29dzQV6IN6fUH5W' },
  { envVar: 'STRIPE_PRICE_COMM_ROOKIE', desc: 'Comm Hub Rookie', livePriceId: 'price_1TGRpwLFq29dzQV6MIJ5jBZb' },
  { envVar: 'STRIPE_PRICE_COMM_VARSITY', desc: 'Comm Hub Varsity', livePriceId: 'price_1TGRptLFq29dzQV6hNJW0TLH' },
  { envVar: 'STRIPE_PRICE_COMM_ALL_CONFERENCE', desc: 'Comm Hub All-Conference', livePriceId: 'price_1TGRppLFq29dzQV60plP2CCR' },
  { envVar: 'STRIPE_PRICE_COMM_ALL_STATE', desc: 'Comm Hub All-State', livePriceId: 'price_1TGRpiLFq29dzQV6C7GQvG8m' },
  { envVar: 'STRIPE_PRICE_COMM_VIDEO_TOPUP', desc: 'Video Top-up Pack', livePriceId: 'price_1TI6IeLFq29dzQV60Oyo6bWB' },
  { envVar: 'STRIPE_PARENT_PROFILE_PRICE_ID', desc: 'Parent Profile Annual', livePriceId: 'price_1TGRinLFq29dzQV69wCq2PJF' },
];

async function fetchPrice(stripe, priceId, mode) {
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    return { found: true, price, mode };
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'resource_missing') {
      return { found: false };
    }
    throw err;
  }
}

async function ensureProductInTestMode(productData) {
  // Check if product already exists in test mode
  try {
    const existing = await testStripe.products.retrieve(productData.id);
    return { product: existing, created: false };
  } catch {
    // Product doesn't exist in test mode — create it
  }

  const product = await testStripe.products.create({
    name: productData.name,
    description: productData.description || undefined,
    metadata: productData.metadata || {},
  });

  return { product, created: true };
}

async function main() {
  console.log('Stripe Tax Price Migration (LIVE MODE ONLY — 7 remaining prices)');
  console.log('='.repeat(80));
  console.log(`Live key: ${liveKey.substring(0, 8)}...`);
  console.log('');

  const results = [];

  for (const item of PRICE_VARS) {
    const oldPriceId = item.livePriceId;

    console.log(`Processing: ${item.desc} (${item.envVar})...`);
    console.log(`  Source: ${oldPriceId}`);

    try {
      // Fetch existing price from live mode using hardcoded original ID
      let result = await fetchPrice(liveStripe, oldPriceId, 'live');

      if (!result.found) {
        results.push({
          envVar: item.envVar,
          desc: item.desc,
          oldPriceId,
          newPriceId: 'FAILED',
          amount: '-',
          source: '-',
          productCreated: false,
          error: 'Price not found in live mode',
        });
        continue;
      }

      const { price } = result;
      const product = price.product;
      const productData = typeof product === 'string'
        ? { id: product, name: item.desc, description: null, metadata: {} }
        : product;

      // Product already exists in live mode — use it directly
      let productCreated = false;
      let targetProductId = typeof product === 'string' ? product : product.id;

      // No need to create product — it already exists since the price exists
      if (false) {
        // Need to ensure product exists in test mode
        const { product: testProduct, created } = await ensureProductInTestMode(productData);
        testProductId = testProduct.id;
        productCreated = created;
      }

      // Step 4: Create new price with tax_behavior: 'exclusive'
      const newPriceParams = {
        product: targetProductId,
        currency: price.currency,
        unit_amount: price.unit_amount,
        tax_behavior: 'exclusive',
        metadata: {
          ...price.metadata,
          migrated_from: oldPriceId,
          migration_date: new Date().toISOString(),
        },
      };

      if (price.recurring) {
        newPriceParams.recurring = {
          interval: price.recurring.interval,
          interval_count: price.recurring.interval_count,
        };
        if (price.recurring.trial_period_days) {
          newPriceParams.recurring.trial_period_days = price.recurring.trial_period_days;
        }
      }

      const newPrice = await liveStripe.prices.create(newPriceParams);

      const amountStr = price.currency === 'usd'
        ? `$${(price.unit_amount / 100).toFixed(2)}`
        : `${price.unit_amount} ${price.currency}`;

      const intervalStr = price.recurring
        ? `/${price.recurring.interval}`
        : ' (one-time)';

      results.push({
        envVar: item.envVar,
        desc: item.desc,
        oldPriceId,
        newPriceId: newPrice.id,
        amount: `${amountStr}${intervalStr}`,
        source: 'live',
        productCreated,
        error: null,
      });

      console.log(`  ✅ Created: ${newPrice.id}`);
    } catch (err) {
      results.push({
        envVar: item.envVar,
        desc: item.desc,
        oldPriceId,
        newPriceId: 'ERROR',
        amount: '-',
        source: '-',
        productCreated: false,
        error: err.message,
      });
      console.log(`  ❌ Error: ${err.message}`);
    }
  }

  // Output mapping table
  console.log('');
  console.log('='.repeat(120));
  console.log('MIGRATION RESULTS');
  console.log('='.repeat(120));
  console.log('');

  // Header
  console.log(
    'Env Var'.padEnd(42) +
    'Old Price ID'.padEnd(34) +
    'New Price ID'.padEnd(34) +
    'Amount'.padEnd(16) +
    'Source'.padEnd(8) +
    'Product Created'
  );
  console.log('-'.repeat(120));

  for (const r of results) {
    if (r.error && r.newPriceId !== 'SKIPPED') {
      console.log(
        r.envVar.padEnd(42) +
        r.oldPriceId.padEnd(34) +
        `ERROR: ${r.error}`
      );
    } else if (r.newPriceId === 'SKIPPED') {
      console.log(
        r.envVar.padEnd(42) +
        '(not set)'.padEnd(34) +
        'SKIPPED'
      );
    } else {
      console.log(
        r.envVar.padEnd(42) +
        r.oldPriceId.padEnd(34) +
        r.newPriceId.padEnd(34) +
        r.amount.padEnd(16) +
        r.source.padEnd(8) +
        (r.productCreated ? 'YES' : 'no')
      );
    }
  }

  // Output env var update block
  console.log('');
  console.log('='.repeat(120));
  console.log('ENV VAR UPDATE (copy to .env.local after review):');
  console.log('='.repeat(120));
  console.log('');

  const successful = results.filter(r => r.newPriceId && !r.error && r.newPriceId !== 'SKIPPED' && r.newPriceId !== 'FAILED' && r.newPriceId !== 'ERROR');
  for (const r of successful) {
    console.log(`${r.envVar}=${r.newPriceId}`);
  }

  if (successful.length < PRICE_VARS.length) {
    const failed = results.filter(r => r.error || r.newPriceId === 'FAILED' || r.newPriceId === 'ERROR');
    if (failed.length > 0) {
      console.log('');
      console.log('⚠️  FAILED / SKIPPED:');
      for (const r of failed) {
        console.log(`  ${r.envVar}: ${r.error}`);
      }
    }
  }

  console.log('');
  console.log(`Done. ${successful.length}/${PRICE_VARS.length} prices created successfully.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
