# The Coach Hub - Production Deployment Plan

**Status:** Ready to deploy when needed
**Target Platform:** Vercel (free tier)
**Database:** Supabase (current paid tier - no additional cost)
**Timeline:** Can complete in 2-3 hours when ready

---

## Pre-Deployment Checklist

Before starting deployment, ensure:

- [ ] All current features tested locally and working
- [ ] Database migrations are in `/supabase/migrations/` folder
- [ ] No sensitive data in git (check .gitignore includes .env.local)
- [ ] GitHub repository is up to date with latest code
- [ ] You have access to your Supabase dashboard
- [ ] You have a Vercel account (can sign up with GitHub)

---

## STEP 1: Prepare Supabase for Production (30 minutes)

### Option A: Use Current Project (Recommended for Solo Use)

**Pros:** Simple, no extra cost, faster setup
**Cons:** Dev and prod share same database (be careful with test data)

1. **Go to Supabase Dashboard** → Your Project → Settings → API

2. **Note these values** (you'll need them for Vercel):
   ```
   Project URL: https://[your-project].supabase.co
   Anon Public Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Add Production URL to Allowed Origins:**
   - Settings → Authentication → URL Configuration
   - Add Site URL: `https://thecoachhub.com` (or your custom domain)
   - Add Redirect URL: `https://thecoachhub.com/auth/callback`

4. **Review RLS Policies:**
   - Database → Tables → Check all tables have RLS enabled
   - Test policies are working correctly

5. **Set up Database Backups** (if not already):
   - Settings → Database → Backups
   - Daily backups are automatic on paid tier ✅

### Option B: Create Separate Production Project (More Professional)

**Pros:** Clean separation, safer for testing
**Cons:** Need to run migrations twice, manage two projects

1. **Create New Project:**
   - Supabase Dashboard → New Project
   - Name: "the-coach-hub-production"
   - Choose same region as your current project
   - Same organization → No additional cost ✅

2. **Run All Migrations:**
   ```bash
   # Install Supabase CLI if not installed
   npm install -g supabase

   # Link to new production project
   supabase link --project-ref [new-project-ref]

   # Run all migrations
   supabase db push
   ```

3. **Copy Data (Optional):**
   - If you have test data you want in prod, export from dev and import to prod
   - Or start fresh in production

4. **Note production credentials** (same as Option A, step 2)

---

## STEP 2: Deploy to Vercel (30 minutes)

### 2.1 - Connect Repository to Vercel

1. **Go to Vercel:** https://vercel.com
2. **Sign Up/Login** with GitHub
3. **Import Project:**
   - "Add New..." → Project
   - Select your GitHub repository: `the-coach-hub`
   - Click "Import"

### 2.2 - Configure Project Settings

**Framework Preset:** Next.js (auto-detected) ✅

**Build & Development Settings:**
```
Build Command:        npm run build
Output Directory:     .next (auto-detected)
Install Command:      npm install
Development Command:  npm run dev
```

**Root Directory:** `./` (leave as default)

### 2.3 - Add Environment Variables

Click "Environment Variables" and add:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# (Add any other environment variables from your .env.local)
```

**Important:**
- Use your **production** Supabase credentials (from Step 1)
- Don't copy service_role key (keep that secret)
- Make sure variables start with `NEXT_PUBLIC_` if used in browser

### 2.4 - Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. You'll get a URL: `https://the-coach-hub.vercel.app`

---

## STEP 3: Post-Deployment Testing (30-60 minutes)

### 3.1 - Basic Functionality Test

Visit your production URL and test:

- [ ] **Homepage loads** (should redirect if logged in)
- [ ] **Sign Up Flow:**
  - Create new account with test email
  - Check email for confirmation (if email confirmation enabled)
  - Confirm email and login
- [ ] **Create Team:**
  - Click "Get Started"
  - Fill out team form
  - Verify team created successfully
- [ ] **Test Core Features:**
  - [ ] Create a play in playbook
  - [ ] Upload a test video to film library
  - [ ] Check schedule page loads
  - [ ] Verify analytics page loads (may be empty - that's OK)
  - [ ] Test practice plan creation

### 3.2 - Error Testing

- [ ] Try to access `/teams/fake-uuid` (should handle gracefully)
- [ ] Try to create duplicate team name (should handle gracefully)
- [ ] Log out and try to access protected pages (should redirect to login)
- [ ] Test on mobile browser (at least check homepage + login)

### 3.3 - Database Verification

Go to Supabase Dashboard:

- [ ] Check `teams` table has new test team
- [ ] Check `playbook_plays` table if you created a play
- [ ] Verify RLS is working (you can only see your own data)

### 3.4 - Performance Check

- [ ] Check Vercel Dashboard → Analytics
- [ ] Verify page load times are reasonable (< 3 seconds)
- [ ] Check for any build warnings or errors

---

## STEP 4: Custom Domain (Optional - 15 minutes)

If you own a domain (e.g., thecoachhub.com):

1. **Add Domain in Vercel:**
   - Project Settings → Domains
   - Add your domain
   - Follow DNS setup instructions

2. **Update Supabase:**
   - Add your custom domain to Allowed Origins
   - Update redirect URLs to use custom domain

3. **SSL Certificate:**
   - Vercel automatically provisions SSL (free via Let's Encrypt)
   - Wait 5-10 minutes for DNS to propagate

---

## STEP 5: Monitoring & Safety Net (30 minutes)

### 5.1 - Set Up Error Monitoring (Free)

**Option A: Vercel Built-in Monitoring**
- Automatically included
- Dashboard → Analytics → Errors
- Shows runtime errors and build failures

**Option B: Sentry (Recommended for Better Tracking)**

1. Sign up at https://sentry.io (free tier)
2. Create new project → Select Next.js
3. Install Sentry:
   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard@latest -i nextjs
   ```
4. Add Sentry DSN to Vercel environment variables
5. Redeploy

### 5.2 - Set Up Uptime Monitoring (Free)

**UptimeRobot** (https://uptimerobot.com):
- Free for up to 50 monitors
- Check your site every 5 minutes
- Email alerts if site goes down

Setup:
1. Create account
2. Add new monitor → HTTP(s)
3. URL: Your Vercel production URL
4. Email: Your email for alerts

### 5.3 - Database Backups

Verify in Supabase:
- Settings → Database → Backups
- Should show "Daily backups enabled" ✅
- Paid tier includes 7 days of backups

---

## STEP 6: Documentation & Maintenance

### 6.1 - Create .env.example

For future reference and team members:

```bash
# Create example env file (don't include real values)
cat > .env.example << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EOF
```

Add to git:
```bash
git add .env.example
git commit -m "docs: Add environment variables example"
git push
```

### 6.2 - Update README.md

Add deployment section to your README:

```markdown
## Production Deployment

Live site: https://thecoachhub.com

### Tech Stack
- **Frontend:** Next.js 15 + React 19
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Auth:** Supabase Auth

### Environment Variables
See `.env.example` for required configuration.
```

### 6.3 - Create Deployment Checklist

For future updates:

```markdown
## Pre-Deploy Checklist
- [ ] All tests passing locally
- [ ] Database migrations tested
- [ ] No console errors in dev mode
- [ ] Code committed to main branch
- [ ] Environment variables up to date

## Deploy Process
1. Push to GitHub main branch
2. Vercel auto-deploys (2-3 minutes)
3. Test production URL
4. Monitor Vercel dashboard for errors
```

---

## Rollback Plan (If Something Goes Wrong)

### If Deployment Fails:

1. **Check Vercel Build Logs:**
   - Deployments → Failed deployment → View logs
   - Look for error messages

2. **Common Issues:**
   - Missing environment variables → Add them in Vercel settings
   - Build errors → Check `npm run build` works locally
   - TypeScript errors → Fix in code, commit, push again

3. **Rollback to Previous Version:**
   - Vercel → Deployments → Previous deployment → "..." → Promote to Production

### If Database Issues:

1. **Check Supabase Logs:**
   - Database → Logs
   - Look for RLS policy errors or connection issues

2. **Verify RLS Policies:**
   - Run this in SQL Editor:
   ```sql
   SELECT tablename, policyname, permissive, roles, cmd
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

3. **Restore from Backup (if needed):**
   - Settings → Database → Backups
   - Choose backup → Restore

---

## Cost Breakdown

**Monthly Costs:**

| Service | Tier | Cost | Notes |
|---------|------|------|-------|
| Vercel | Free (Hobby) | $0 | Includes SSL, CDN, auto-deploys |
| Supabase | Pro | $25/month | Already paying - covers unlimited projects |
| Domain (optional) | - | ~$12/year | Only if you want custom domain |
| Monitoring (optional) | Free | $0 | Vercel built-in + UptimeRobot free tier |

**Total: $25/month** (same as you're paying now) ✅

**To scale later:**
- Vercel Pro: $20/month (better performance, more team features)
- Supabase Team: $599/month (only needed for very high traffic)

---

## When You're Ready to Deploy

**Run through this checklist:**

1. [ ] Read through this entire plan
2. [ ] Decide: Same Supabase project or separate production project?
3. [ ] Set aside 2-3 hours of uninterrupted time
4. [ ] Have Supabase dashboard open
5. [ ] Have GitHub repo ready
6. [ ] Follow steps 1-6 in order
7. [ ] Don't skip testing (Step 3)!

**Questions before deploying?**
- Check CLAUDE.md for architecture details
- Test locally first: `npm run build && npm start`
- Commit all changes to GitHub before starting

---

## Quick Reference - Commands

```bash
# Test production build locally (before deploying)
npm run build
npm start

# View build in production mode
# Visit: http://localhost:3000

# If build succeeds locally, it should deploy fine to Vercel ✅

# Check for TypeScript errors
npx tsc --noEmit

# Check for linting issues
npm run lint
```

---

## Support Resources

**If you get stuck:**

- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Your CLAUDE.md:** Has full architecture documentation

**Common Vercel Deployment Issues:**
- https://vercel.com/docs/deployments/troubleshoot

**Supabase Production Checklist:**
- https://supabase.com/docs/guides/platform/going-into-prod

---

## Notes

- **Last Updated:** 2025-11-03
- **App Version:** 0.1.0
- **Ready to Deploy:** YES ✅
- **Deployment Mode:** Vercel + Supabase (same project)

**When ready, just work through Steps 1-6 above!**
