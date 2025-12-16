---
title: Billing & Payments
description: Manage your payment methods, view invoices, and understand billing in Youth Coach Hub.
order: 3
---

## Overview

All billing and payment management happens in the Console. As the team owner, you have access to payment methods, invoices, and subscription details.

## Accessing Billing

1. Click your profile icon in the navigation
2. Select **Console**
3. Click **Billing** in the Console navigation

## Billing Dashboard

The billing page shows:

- **Current Plan** - Your active subscription
- **Billing Cycle** - Monthly or annual
- **Next Payment** - Date and amount
- **Payment Method** - Card on file
- **Usage** - Tokens and credits used

## Payment Methods

Payment methods are securely managed through Stripe, our payment processor. We never store your card details directly.

### Managing Your Payment Method

1. Go to **Console > Billing**
2. Click **Manage Payment Method**
3. You'll be redirected to Stripe's secure billing portal
4. Add, update, or remove payment methods there

### Accepted Payment Types

- **Credit Cards** - Visa, Mastercard, American Express, Discover
- **Debit Cards** - Most debit cards with card network logos

### Updating Your Card

When your card expires or changes:

1. Go to **Console > Billing**
2. Click **Manage Payment Method**
3. In the Stripe portal, add your new card and set it as default

> **Note:** You must have at least one valid payment method for active subscriptions.

## Billing Cycles

### Monthly Billing

- Charged on the same date each month
- Based on when you first subscribed
- Example: Subscribed on the 15th = billed on the 15th

### Annual Billing

- Charged once per year
- 20% savings over monthly
- Renews on subscription anniversary

### Changing Your Billing Cycle

To switch from monthly to annual (or vice versa):

1. Go to **Console > Billing**
2. Click **Change Billing Cycle**
3. Select your preferred cycle
4. Confirm the change

## Invoices and Receipts

### Viewing Invoices

1. Go to **Console > Billing**
2. Click **Manage Payment Method**
3. In the Stripe portal, view your billing history and invoices

### Invoice Details

Each invoice shows:

- Invoice number
- Date
- Amount charged
- Payment method used
- Plan and period

### Downloading Invoices

1. Open the Stripe billing portal
2. Find the invoice in your history
3. Click to download the PDF

### Need an Invoice for Reimbursement?

All invoices include:

- Your name/organization
- Service description
- Amount paid
- Payment date

Contact support if you need additional details for school reimbursement.

## Understanding Charges

### Regular Subscription Charges

Your plan price, charged each cycle:

| Plan | Monthly | Annual |
|------|---------|--------|
| Basic | Free | Free |
| Plus | $29.99 | $299.90 |
| Premium | $79.99 | $799.90 |

### Prorated Charges

When you upgrade mid-cycle:

- Charged for remaining days at new rate
- Credit applied for unused days at old rate
- Net difference charged immediately

## Failed Payments

### Why Payments Fail

Common reasons:

- Expired card
- Insufficient funds
- Card declined by bank
- Incorrect card details

### What Happens When Payment Fails

When a payment fails, here's the process:

1. **Immediate:** Stripe attempts to charge your card
2. **Day 1:** You receive an email notification about the failed payment
3. **Days 1-7:** A warning banner appears in the app showing days remaining
4. **During grace period:** Stripe makes multiple retry attempts automatically
5. **After 7 days:** If not resolved, account access is suspended

### In-App Warning Banner

When your payment fails, you'll see a warning banner at the top of the app:

- **Amber banner:** Shows during the 7-day grace period with countdown
- **Action button:** Click "Update Payment" to fix immediately
- **Dismissible:** You can dismiss the banner for 24 hours, but it will return

### Grace Period (7 Days)

After a payment fails, you have **7 days** to update your payment method:

- Full access continues during this period
- The warning banner shows how many days remain
- Stripe automatically retries payment during this time
- If payment succeeds (retry or updated card), the warning clears

### Account Suspension

If the grace period expires without successful payment:

- Access to team features is blocked
- You'll be redirected to a payment update page
- Your data is preserved and safe
- Access is restored immediately when payment succeeds

### Resolving Failed Payments

To restore access:

1. Go to **Console > Billing**
2. Click **Manage Payment Method**
3. Update your card in Stripe's secure portal
4. Payment will be retried automatically
5. Once successful, access is restored immediately

### Avoiding Payment Issues

To prevent failed payments:

- Keep your card details up to date
- Update expiring cards before they expire
- Ensure sufficient funds around billing dates
- Add a backup payment method in Stripe

## Refunds

### Refund Policy

When you cancel your subscription, you keep full access until the end of your current billing period. No prorated refunds are issued.

- **Monthly subscriptions:** Access continues until end of current month
- **Annual subscriptions:** Access continues until end of current year

### Questions About Charges

If you have questions about a charge:

1. Contact support
2. Explain the situation
3. We'll review and respond

## Tax Information

### Sales Tax

Depending on your location:

- Sales tax may be added to charges
- Tax appears as a separate line on invoices
- Rates determined by your billing address

### Tax-Exempt Organizations

If your organization is tax-exempt:

1. Contact support
2. Provide tax-exempt documentation
3. We'll update your account
4. Future charges won't include tax

### Updating Billing Address

Your billing address affects tax calculations:

1. Go to **Console > Billing**
2. Update your billing address
3. Future invoices reflect the new address

## Multiple Teams

### Separate Subscriptions

Each team has its own subscription:

- Billed independently
- Can have different plans
- Managed separately in the Console

### Viewing All Subscriptions

If you own multiple teams:

1. Go to **Console > Billing**
2. Switch between teams
3. Each team shows its own billing

### Organization-Wide Billing

For large organizations with multiple teams, each team maintains its own separate subscription.

## Security

### Payment Security

Your payment information is secure:

- Processed by Stripe (industry standard)
- Card numbers are not stored on our servers
- PCI-DSS compliant
- SSL encryption on all transactions

### Fraud Protection

We monitor for suspicious activity:

- Unusual login locations
- Multiple failed payment attempts
- Unexpected plan changes

## Common Questions

### When will I be charged?

On your billing date each month (or year for annual). Check billing for your specific date.

### Can I get a receipt for each payment?

Yes, invoices are available in your billing history immediately after each charge.

### How do I update my billing email?

Billing notifications go to your account email. Update your email in account settings.

### What if I need to dispute a charge?

Contact support first. We'll investigate and resolve most issues directly.

### Can I pay by check or invoice?

We currently only accept credit and debit card payments through Stripe.

### Is my payment information safe?

Yes, we use Stripe for payment processing and never store your full card number.

## Troubleshooting

### Can't Access Billing

- Only team owners can access billing
- Make sure you're logged into the correct account
- Try logging out and back in

### Issues with Payment Method

If you're having trouble updating your payment method in Stripe:

- Verify card details are correct
- Check that the card isn't expired
- Try a different card
- Contact support if issues persist

### Wrong Amount Charged

- Check for prorated charges from plan changes
- Review add-on purchases
- Check tax charges
- Contact support if it still seems wrong

## Next Steps

- [Compare plans](/guide/subscriptions/tier-comparison) for upgrade options
- [Change your plan](/guide/subscriptions/upgrading)
- [Contact support](/guide/support/providing-feedback) with billing questions
