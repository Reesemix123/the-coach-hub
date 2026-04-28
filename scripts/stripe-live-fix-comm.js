#!/usr/bin/env node
/**
 * Stripe LIVE mode — fix Comm Hub Varsity / All-Conference / All-State prices.
 *
 * Three current paid prices (Varsity $79, All-Conference $149, All-State $249)
 * exist in live mode with tax_behavior=unspecified. Stripe automatic_tax
 * checkout sessions reject prices that don't have an explicit tax_behavior,
 * so this script creates three replacements with tax_behavior='exclusive'
 * and archives the old ones.
 *
 * Usage:
 *   node scripts/stripe-live-fix-comm.js sk_live_...
 *
 * The key is read from argv[2] only — never from .env.local. Refuses to run
 * with anything other than a sk_live_ key (target product IDs are live-only).
 *
 * Operations performed (LIVE MODE):
 *   1. Pre-flight: verify all 3 products exist, are active, and have the
 *      expected names. Verify the 3 prices to archive exist.
 *   2. Create 3 new prices (one_time, USD, tax_behavior='exclusive').
 *   3. Archive the 3 old unspecified prices.
 *   4. Print the new price IDs in a copy-pasteable env var format.
 */

const Stripe = require('stripe')

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

const PRICES_TO_CREATE = [
  {
    product: 'prod_UEvhkDV6TDqbex',
    expectedName: /varsity/i,
    amount: 7900,
    envVar: 'STRIPE_PRICE_COMM_VARSITY',
    nickname: 'Communication Hub — Varsity ($79)',
  },
  {
    product: 'prod_UEvhdtAnpwaKJa',
    expectedName: /all.?conference/i,
    amount: 14900,
    envVar: 'STRIPE_PRICE_COMM_ALL_CONFERENCE',
    nickname: 'Communication Hub — All-Conference ($149)',
  },
  {
    product: 'prod_UEvh0oNiadwtXN',
    expectedName: /all.?state/i,
    amount: 24900,
    envVar: 'STRIPE_PRICE_COMM_ALL_STATE',
    nickname: 'Communication Hub — All-State ($249)',
  },
]

const PRICES_TO_ARCHIVE = [
  { id: 'price_1TIg7LLFq29dzQV6PybPdcyU', label: 'Varsity $79 (unspecified)' },
  { id: 'price_1TIgAdLFq29dzQV6FfVE2k28', label: 'All-Conference $149 (unspecified)' },
  { id: 'price_1TIgDXLFq29dzQV6cXXcONWm', label: 'All-State $249 (unspecified)' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(msg) {
  console.error(`✖  ${msg}`)
  process.exit(1)
}

function fmtAmount(unit, currency = 'usd') {
  return `$${(unit / 100).toFixed(2)} ${currency.toUpperCase()}`
}

// ---------------------------------------------------------------------------
// Validate args
// ---------------------------------------------------------------------------

const key = process.argv[2]
if (!key) {
  fail('Missing key. Usage: node scripts/stripe-live-fix-comm.js sk_live_...')
}
if (!key.startsWith('sk_')) {
  fail('Argument does not look like a Stripe secret key (should start with "sk_").')
}
if (!key.startsWith('sk_live_')) {
  fail(
    'Refusing to run with a non-live key. The target product IDs are live-mode only.\n' +
    'If you want to test the script logic, use stripe-live-audit.js instead — that one is read-only.',
  )
}

const stripe = new Stripe(key)

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

;(async () => {
  // Verify account
  const account = await stripe.accounts.retrieve()
  console.log(`Account: ${account.id}`)
  console.log(`Name:    ${account.business_profile?.name ?? account.email ?? '—'}`)
  console.log('Mode:    LIVE\n')

  // ---------- 1. Pre-flight ----------
  console.log('=== PRE-FLIGHT: verifying target products ===')
  for (const target of PRICES_TO_CREATE) {
    let product
    try {
      product = await stripe.products.retrieve(target.product)
    } catch (e) {
      fail(`Cannot retrieve product ${target.product}: ${e.message}`)
    }
    if (!product.active) {
      fail(`Product ${target.product} is archived. Refusing to create a price on an archived product.`)
    }
    if (!target.expectedName.test(product.name)) {
      fail(
        `Product ${target.product} has unexpected name "${product.name}". ` +
        `Expected to match ${target.expectedName}. Refusing to proceed.`,
      )
    }
    console.log(`  ✓ ${target.product} → "${product.name}"`)
  }

  console.log('\n=== PRE-FLIGHT: verifying prices to archive ===')
  for (const p of PRICES_TO_ARCHIVE) {
    let price
    try {
      price = await stripe.prices.retrieve(p.id)
    } catch (e) {
      fail(`Cannot retrieve price ${p.id}: ${e.message}`)
    }
    if (!price.active) {
      p.alreadyArchived = true
      console.log(`  ⚠  ${p.id} (${p.label}) is already archived — will skip`)
    } else {
      console.log(`  ✓ ${p.id} (${p.label}) is active, will archive`)
    }
  }

  // ---------- 2. Create new prices ----------
  console.log('\n=== CREATING NEW PRICES ===')
  const created = []
  for (const target of PRICES_TO_CREATE) {
    try {
      const price = await stripe.prices.create({
        product: target.product,
        unit_amount: target.amount,
        currency: 'usd',
        tax_behavior: 'exclusive',
        nickname: target.nickname,
      })
      created.push({ ...target, id: price.id, livemode: price.livemode })
      console.log(
        `  ✓ ${price.id}  ${fmtAmount(price.unit_amount, price.currency)}  ` +
        `tax:${price.tax_behavior}  on ${target.product}  livemode:${price.livemode}`,
      )
    } catch (e) {
      console.error(`  ✖  Failed to create price for ${target.product}: ${e.message}`)
      if (created.length > 0) {
        console.error('\n⚠  Aborting before archives.')
        console.error('   Already-created prices remain in Stripe and need manual cleanup or reuse:')
        created.forEach((c) => console.error(`     - ${c.id} (${c.envVar})`))
      }
      process.exit(1)
    }
  }

  // ---------- 3. Archive old prices ----------
  console.log('\n=== ARCHIVING OLD PRICES ===')
  let archivedCount = 0
  let archiveFailures = 0
  for (const p of PRICES_TO_ARCHIVE) {
    if (p.alreadyArchived) {
      console.log(`  → ${p.id} already archived, skipped`)
      continue
    }
    try {
      const updated = await stripe.prices.update(p.id, { active: false })
      console.log(`  ✓ ${p.id} archived (active=${updated.active})  [${p.label}]`)
      archivedCount++
    } catch (e) {
      console.error(`  ✖  Failed to archive ${p.id} [${p.label}]: ${e.message}`)
      archiveFailures++
    }
  }

  // ---------- 4. Vercel env var mapping ----------
  console.log('\n=== VERCEL ENV VAR MAPPING (LIVE) ===')
  console.log('Copy these into Vercel → Project Settings → Environment Variables (Production):\n')
  for (const c of created) {
    console.log(`${c.envVar}=${c.id}`)
  }

  // ---------- Summary ----------
  console.log('\n=== SUMMARY ===')
  console.log(`Created:  ${created.length} live-mode price(s) with tax_behavior=exclusive`)
  console.log(`Archived: ${archivedCount} old live-mode price(s)`)
  if (archiveFailures > 0) {
    console.log(`Archive failures: ${archiveFailures} — review errors above and archive manually if needed.`)
    process.exit(1)
  }
  console.log('Done.')
})().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
