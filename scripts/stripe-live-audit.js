#!/usr/bin/env node
/**
 * Stripe LIVE mode price audit. Read-only.
 *
 * Usage:
 *   node scripts/stripe-live-audit.js sk_live_...
 *
 * The secret key is taken from argv[2] only — this script never reads
 * .env.local. Pass the live key from your password manager / Vercel dashboard
 * for a one-time audit, then forget it.
 *
 * Output:
 *   1. Account info (id, business name, mode)
 *   2. All products + their prices, grouped by product
 *   3. Unspecified-tax_behavior summary
 *   4. Recommended Vercel env var mapping based on target prices below
 *   5. Pointer for finding the publishable key in the dashboard
 */

const Stripe = require('stripe')

// ---------------------------------------------------------------------------
// Targets — what each env var SHOULD point at
// ---------------------------------------------------------------------------

const TARGETS = [
  { envVar: 'STRIPE_PRICE_PLUS_MONTHLY',                 label: 'Plus Monthly',           productMatch: /plus/i,                     amount: 2999,  interval: 'month' },
  { envVar: 'STRIPE_PRICE_PLUS_YEARLY',                  label: 'Plus Yearly',            productMatch: /plus/i,                     amount: 29999, interval: 'year' },
  { envVar: 'STRIPE_PRICE_PREMIUM_MONTHLY',              label: 'Premium Monthly',        productMatch: /premium/i,                  amount: 7999,  interval: 'month' },
  { envVar: 'STRIPE_PRICE_PREMIUM_YEARLY',               label: 'Premium Yearly',         productMatch: /premium/i,                  amount: 79999, interval: 'year' },
  { envVar: 'STRIPE_PRICE_TOKEN_SINGLE',                 label: 'Game Token',             productMatch: /token|extra game/i,         amount: 1200,  interval: null    },
  { envVar: 'STRIPE_PRICE_COMM_VARSITY',                 label: 'Comm Hub Varsity',       productMatch: /varsity/i,                  amount: 7900,  interval: null    },
  { envVar: 'STRIPE_PRICE_COMM_ALL_CONFERENCE',          label: 'Comm Hub All-Conference',productMatch: /all.?conference/i,          amount: 14900, interval: null    },
  { envVar: 'STRIPE_PRICE_COMM_ALL_STATE',               label: 'Comm Hub All-State',     productMatch: /all.?state/i,               amount: 24900, interval: null    },
  { envVar: 'STRIPE_PRICE_COMM_VIDEO_TOPUP',             label: 'Comm Hub Video Top-Up',  productMatch: /video.?(top.?up|topup)/i,   amount: 3900,  interval: null    },
  { envVar: 'NEXT_PUBLIC_STRIPE_PARENT_PROFILE_PRICE_ID',label: 'Parent / Player Profile',productMatch: /(parent|player)\s*profile/i,amount: 1999,  interval: 'year'  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(msg) {
  console.error(`✖  ${msg}`)
  process.exit(1)
}

function fmtAmount(p) {
  if (p.unit_amount == null) return '—'
  return `$${(p.unit_amount / 100).toFixed(2)} ${p.currency.toUpperCase()}`
}

function fmtRecurring(p) {
  if (!p.recurring) return 'one_time'
  const n = p.recurring.interval_count
  return n === 1 ? `every ${p.recurring.interval}` : `every ${n} ${p.recurring.interval}s`
}

function fmtCreated(unix) {
  return new Date(unix * 1000).toISOString().slice(0, 10)
}

function targetSummary(t) {
  const dollars = `$${(t.amount / 100).toFixed(2)}`
  return t.interval ? `${dollars}/${t.interval}` : `${dollars} one_time`
}

// ---------------------------------------------------------------------------
// Validate args
// ---------------------------------------------------------------------------

const key = process.argv[2]
if (!key) {
  fail('Missing key. Usage: node scripts/stripe-live-audit.js sk_live_...')
}
if (!key.startsWith('sk_')) {
  fail('Argument does not look like a Stripe secret key (should start with "sk_").')
}
const isLive = key.startsWith('sk_live_')
if (!isLive) {
  console.warn(`⚠  Key starts with "${key.slice(0, 8)}…" — not a live key. Audit will run against TEST mode.\n`)
}

const stripe = new Stripe(key)

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

;(async () => {
  // 1. Account
  let account
  try {
    account = await stripe.accounts.retrieve()
  } catch (e) {
    fail(`Failed to authenticate: ${e.message}`)
  }
  console.log('=== ACCOUNT ===')
  console.log(`id:        ${account.id}`)
  console.log(`name:      ${account.business_profile?.name ?? account.email ?? '—'}`)
  console.log(`mode:      ${isLive ? 'LIVE' : 'TEST'}`)
  console.log()

  // 2. Fetch all products + prices (auto-paginate)
  const products = []
  for await (const p of stripe.products.list({ limit: 100 })) {
    products.push(p)
  }

  const allPrices = []
  for await (const p of stripe.prices.list({ limit: 100 })) {
    allPrices.push(p)
  }

  const pricesByProduct = new Map()
  for (const price of allPrices) {
    const pid = typeof price.product === 'string' ? price.product : price.product?.id
    if (!pid) continue
    if (!pricesByProduct.has(pid)) pricesByProduct.set(pid, [])
    pricesByProduct.get(pid).push(price)
  }

  // 3. Group output by product (sorted by name)
  products.sort((a, b) => a.name.localeCompare(b.name))
  console.log(`=== PRODUCTS (${products.length}) ===`)

  const unspecifiedFlags = []
  for (const product of products) {
    const prices = pricesByProduct.get(product.id) ?? []
    const status = product.active ? 'active' : 'ARCHIVED'
    console.log(`\n[${product.name}]  ${product.id}  (${status})`)
    if (!prices.length) {
      console.log('    (no prices)')
      continue
    }
    // sort prices: active first, then by amount asc
    prices.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return (a.unit_amount ?? 0) - (b.unit_amount ?? 0)
    })
    for (const p of prices) {
      const tax = p.tax_behavior ?? 'unspecified'
      const taxFlag = (tax === 'unspecified') ? '  ⚠  UNSPECIFIED' : ''
      console.log(`    ${p.id}  (${p.active ? 'active' : 'archived'})`)
      console.log(`        amount:        ${fmtAmount(p)}`)
      console.log(`        type:          ${p.type} (${fmtRecurring(p)})`)
      console.log(`        tax_behavior:  ${tax}${taxFlag}`)
      console.log(`        created:       ${fmtCreated(p.created)}`)
      if (tax === 'unspecified') {
        unspecifiedFlags.push({ id: p.id, product: product.name, amount: fmtAmount(p), active: p.active })
      }
    }
  }

  // 4. Unspecified summary
  console.log('\n=== UNSPECIFIED TAX_BEHAVIOR ===')
  if (!unspecifiedFlags.length) {
    console.log('None — every price has explicit tax_behavior.')
  } else {
    console.log(`${unspecifiedFlags.length} price(s) have tax_behavior=unspecified:`)
    for (const f of unspecifiedFlags) {
      console.log(`  ${f.active ? 'active  ' : 'archived'}  ${f.id}  ${f.amount}  ${f.product}`)
    }
  }

  // 5. Match targets and emit recommended env mapping
  console.log('\n=== RECOMMENDED VERCEL ENV VAR MAPPING ===')
  const productById = new Map(products.map(p => [p.id, p]))

  const used = new Set()
  for (const target of TARGETS) {
    // Filter candidates: active, correct amount/currency/type/interval, name match
    const candidates = allPrices.filter(price => {
      if (!price.active) return false
      if (price.currency !== 'usd') return false
      if (price.unit_amount !== target.amount) return false

      if (target.interval === null) {
        if (price.type !== 'one_time') return false
      } else {
        if (price.type !== 'recurring') return false
        if (price.recurring?.interval !== target.interval) return false
        if (price.recurring?.interval_count !== 1) return false
      }

      const pid = typeof price.product === 'string' ? price.product : price.product?.id
      const product = productById.get(pid)
      if (!product || !product.active) return false
      return target.productMatch.test(product.name)
    })

    // Prefer tax_behavior=exclusive
    const exclusive = candidates.filter(c => c.tax_behavior === 'exclusive')
    const chosen = (exclusive.length ? exclusive : candidates).slice().sort((a, b) => b.created - a.created)

    if (!chosen.length) {
      console.log(`# ${target.envVar}: NOT FOUND  (target: ${target.label} — ${targetSummary(target)})`)
      continue
    }

    if (chosen.length > 1) {
      console.log(`# ${target.envVar}: ⚠  ${chosen.length} matching prices — using newest. Review:`)
      for (const c of chosen) {
        console.log(`#     ${c.id}  tax:${c.tax_behavior ?? 'unspecified'}  created:${fmtCreated(c.created)}`)
      }
    }

    const winner = chosen[0]
    const tax = winner.tax_behavior ?? 'unspecified'
    const warn = tax === 'exclusive' ? '' : `   # ⚠  tax_behavior=${tax}`
    console.log(`${target.envVar}=${winner.id}${warn}`)
    used.add(winner.id)
  }

  // 6. Unmapped active prices (informational — these aren't broken, just unused by targets)
  const unmapped = allPrices.filter(p => p.active && !used.has(p.id))
  if (unmapped.length) {
    console.log(`\n=== UNMAPPED ACTIVE PRICES (${unmapped.length}) ===`)
    console.log('Active prices not matched to any target env var. Likely orphans, duplicates, or unused tiers.')
    for (const p of unmapped) {
      const pid = typeof p.product === 'string' ? p.product : p.product?.id
      const product = productById.get(pid)
      console.log(`  ${p.id}  ${fmtAmount(p)}  ${fmtRecurring(p)}  tax:${p.tax_behavior ?? 'unspecified'}  →  ${product?.name ?? '?'}`)
    }
  }

  // 7. Publishable key — Stripe API doesn't expose it via secret-key calls
  console.log('\n=== PUBLISHABLE KEY ===')
  console.log('The Stripe API does not return the publishable key from secret-key calls.')
  console.log('Grab it from the dashboard:')
  console.log(`  ${isLive ? 'https://dashboard.stripe.com/apikeys' : 'https://dashboard.stripe.com/test/apikeys'}`)
  console.log(`Format: ${isLive ? 'pk_live_…' : 'pk_test_…'}`)
  console.log(`Account: ${account.id}`)

  console.log('\n=== DONE ===')
  console.log('Read-only audit complete. No prices, products, or env files were modified.')
})().catch(e => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
