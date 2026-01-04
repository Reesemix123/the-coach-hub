// src/app/terms/page.tsx
// LEGAL NOTICE: This Terms of Service is a template and should be reviewed
// by a qualified attorney before commercial launch. This document is provided
// as a starting point and may not cover all legal requirements for your
// specific jurisdiction or business needs.

import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | Youth Coach Hub',
  description: 'Terms of Service for Youth Coach Hub - Football coaching platform for youth and high school programs.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#1a1410] -mt-24">
      {/* Single Fixed Background for entire page */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/marketing/friday-night-field.png)',
            backgroundPosition: 'center 5%'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410]/20 via-[#1a1410]/30 to-[#1a1410]/75"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 backdrop-blur-sm" style={{ background: 'rgba(26,20,16,.65)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <img
            src="/logo-darkmode.png"
            alt="Youth Coach Hub"
            className="h-8 sm:h-10 w-auto"
          />
          <span className="hidden sm:inline text-white font-semibold text-lg tracking-tight">
            youth<span className="text-[#B8CA6E]">coach</span>hub
          </span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-8">
          <Link href="/#features" className="hidden sm:inline text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Features</Link>
          <Link href="/pricing" className="text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Pricing</Link>
          <Link href="/auth/login" className="text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Log In</Link>
          <Link href="/auth/signup" className="h-10 sm:h-12 px-4 sm:px-5 bg-[#B8CA6E] text-[#1a1410] font-black rounded-2xl hover:bg-[#c9d88a] transition-colors text-sm flex items-center justify-center" style={{ boxShadow: '0 14px 28px rgba(184,202,110,.25)' }}>
            Sign Up
          </Link>
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-[#B8CA6E] mb-4 inline-block transition-colors"
          >
            &larr; Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-gray-500">
            Last updated: January 2, 2025
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none">
          {/* Introduction */}
          <section className="mb-16">
            <p className="text-gray-300 leading-relaxed">
              Welcome to Youth Coach Hub. These Terms of Service (&quot;Terms&quot;) govern your access to
              and use of the Youth Coach Hub website, applications, and services (collectively,
              the &quot;Service&quot;). By accessing or using the Service, you agree to be bound by these
              Terms. If you do not agree to these Terms, do not use the Service.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              Youth Coach Hub is operated by Youth Coach Hub LLC, a company registered in
              Utah, USA (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
            </p>
          </section>

          {/* Section 1 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-300 leading-relaxed">
              By creating an account or using the Service, you represent that you are at least
              18 years of age, or if you are under 18, that you have obtained parental or
              guardian consent to use the Service. You also represent that you have the legal
              capacity to enter into a binding agreement.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              2. Account Registration and Responsibilities
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              To use certain features of the Service, you must create an account. When you
              create an account, you agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update your account information as necessary</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized access or security breach</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              You may not share your account credentials with others or allow others to access
              your account. We reserve the right to suspend or terminate accounts that violate
              these Terms.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              3. Acceptable Use Policy
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Youth Coach Hub is designed exclusively for football coaching purposes. By using
              the Service, you agree to the following:
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              3.1 Permitted Use
            </h3>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>Upload and analyze football game film and practice footage</li>
              <li>Create and manage digital playbooks</li>
              <li>Track team rosters and player information</li>
              <li>Use analytics tools for coaching improvement</li>
              <li>Collaborate with authorized coaching staff members</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              3.2 Prohibited Use
            </h3>
            <p className="text-gray-300 leading-relaxed mb-2">
              You may not use the Service to:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>Upload content unrelated to football coaching (other sports, personal videos, etc.)</li>
              <li>Upload, store, or distribute illegal, harmful, or offensive content</li>
              <li>Upload content that infringes on intellectual property rights of others</li>
              <li>Upload content depicting violence, abuse, or exploitation of minors</li>
              <li>Share login credentials or allow unauthorized access to your account</li>
              <li>Attempt to circumvent storage limits or other technical restrictions</li>
              <li>Use the Service for any commercial purpose other than coaching your team</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
              <li>Interfere with or disrupt the Service or servers connected to the Service</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              3.3 Content Moderation
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We reserve the right to review, remove, or disable access to any content that
              violates these Terms or that we determine, in our sole discretion, is
              inappropriate. We may also report illegal content to appropriate authorities.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              4. Subscription Tiers and Capacity Limits
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              All features are available on all subscription tiers. Tiers differ only by capacity limits:
            </p>

            <div className="bg-[#1a1410]/60 backdrop-blur-md border border-white/20 rounded-xl p-6 mb-4 space-y-4 shadow-xl shadow-black/30">
              <div>
                <h4 className="text-white font-semibold">Basic (Free)</h4>
                <ul className="text-gray-400 text-sm mt-2 space-y-1">
                  <li>2 games/month (1 team game + 1 opponent scouting game)</li>
                  <li>1 camera angle per game</li>
                  <li>30-day film retention</li>
                  <li>Up to 3 coaches per team</li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold">Plus ($29.99/month or $299.90/year)</h4>
                <ul className="text-gray-400 text-sm mt-2 space-y-1">
                  <li>4 games/month (2 team games + 2 opponent scouting games)</li>
                  <li>3 camera angles per game</li>
                  <li>180-day film retention</li>
                  <li>Up to 5 coaches per team</li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold">Premium ($79.99/month or $799.90/year)</h4>
                <ul className="text-gray-400 text-sm mt-2 space-y-1">
                  <li>8 games/month (4 team games + 4 opponent scouting games)</li>
                  <li>5 camera angles per game</li>
                  <li>365-day film retention</li>
                  <li>Up to 10 coaches per team</li>
                </ul>
              </div>
            </div>

            <p className="text-gray-300 leading-relaxed mt-4">
              <strong className="text-white">Game Uploads:</strong> Each game you create (your team&apos;s game or
              an opponent scouting game) counts toward your monthly limit. Game uploads reset monthly
              at the start of your billing cycle. Unused uploads do not roll over to the next month.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong className="text-white">Film Retention:</strong> Game film is retained for the period specified by your subscription tier.
              After the retention period, film files may be automatically removed, though your play tags, analytics,
              and playbook data are retained indefinitely.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong className="text-white">Camera Angles:</strong> Each tier limits the number of camera angles you can upload per game.
              This allows you to upload multiple views (e.g., sideline, end zone, all-22) for comprehensive film review.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              5. Content Ownership and License
            </h2>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              5.1 Your Content
            </h3>
            <p className="text-gray-300 leading-relaxed">
              You retain full ownership of all content you upload to the Service, including
              game film, playbooks, player data, and other materials (&quot;Your Content&quot;). We do
              not claim ownership of Your Content.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              5.2 License to Us
            </h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              By uploading Your Content to the Service, you grant us:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-3 mb-4">
              <li>
                <strong className="text-white">(a) Service License:</strong> A limited, non-exclusive, royalty-free license
                to host, store, display, and transmit Your Content solely for the purpose of
                providing the Service to you and your authorized team members. This license
                terminates when you delete Your Content or close your account.
              </li>
              <li>
                <strong className="text-white">(b) AI Training License:</strong> A perpetual, irrevocable, royalty-free
                license to use Your Content in anonymized, aggregated form for the purpose of
                improving our AI features, analytics algorithms, and machine learning models.
                This license survives termination of your account. Your Content used for AI
                training will be de-identified and will not be associated with you or your team.
              </li>
            </ul>
            <p className="text-gray-300 leading-relaxed">
              The license in (a) terminates when you delete Your Content or close your account.
              The license in (b) continues indefinitely to allow ongoing improvement of our Service.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              5.3 Our Content
            </h3>
            <p className="text-gray-300 leading-relaxed">
              The Service, including its design, features, documentation, and all intellectual
              property related thereto, is owned by Youth Coach Hub LLC and is protected by
              copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              6. Subscription and Payment Terms
            </h2>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              6.1 Billing
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Paid subscriptions are billed monthly or annually in advance, depending on your
              selected billing cycle. Payment is processed securely through Stripe. By subscribing
              to a paid plan, you authorize us to charge your payment method on a recurring basis
              until you cancel.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              6.2 Free Trials
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We may offer free trials for certain subscription tiers. A valid payment method
              is required to start a trial. If you do not cancel before the trial ends, your
              subscription will automatically convert to a paid subscription and your payment
              method will be charged.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              6.3 Price Changes
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We may change subscription prices with 30 days&apos; notice. Price changes will take
              effect at the start of your next billing cycle. Continued use of the Service
              after a price change constitutes acceptance of the new price.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              6.4 Refunds
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Subscription fees are generally non-refundable. However, we may provide refunds
              at our discretion in cases of billing errors or service issues. Contact us through
              our contact form for refund requests.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              7. Termination and Account Deletion
            </h2>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              7.1 Termination by You
            </h3>
            <p className="text-gray-300 leading-relaxed">
              You may cancel your subscription or delete your account at any time through your
              account settings. Cancellation will take effect at the end of your current
              billing period. You will retain access to paid features until then.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              7.2 Termination by Us
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We may suspend or terminate your account if you violate these Terms, engage in
              fraudulent activity, or for any other reason at our discretion with reasonable
              notice. In cases of serious violations, we may terminate immediately without notice.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              7.3 Effect of Termination
            </h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              Upon cancellation of your subscription:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2 mb-4">
              <li>You retain full access until the end of your current billing period</li>
              <li>After your subscription ends, you have 30 days to resubscribe and regain full access to your data</li>
              <li>After 30 days without resubscription, you will no longer be able to access your data through the Service</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong className="text-white">Data Retention:</strong> Your data (including playbooks, tagged plays, and analytics) is
              retained indefinitely on our servers. This data may be used in anonymized, aggregated form for
              improving our AI and analytics features (see Section 5.2 and our Privacy Policy). If you resubscribe
              within 30 days, you regain full access to all your historical data.
            </p>
            <p className="text-gray-300 leading-relaxed">
              <strong className="text-white">Immediate Termination:</strong> We may terminate your access immediately without notice for
              serious violations of these Terms, including uploading prohibited content, fraudulent activity, or
              abuse of the Service. In such cases, your subscription will be canceled immediately and you will
              not have access to your data. You may contact us through our contact form if you believe this was done in error.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              8. Disclaimers
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
              KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              We do not warrant that the Service will be uninterrupted, error-free, or
              completely secure. You use the Service at your own risk.
            </p>
            <p className="text-gray-300 leading-relaxed">
              <strong className="text-white">Coaching Disclaimer:</strong> Youth Coach Hub provides tools for coaching
              analysis and planning. We are not responsible for coaching decisions, game
              outcomes, player injuries, or any other results that may occur from your use of
              the Service. The analytics and insights provided are for informational purposes
              only and should not be relied upon as the sole basis for coaching decisions.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              9. Limitation of Liability
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, YOUTH COACH HUB LLC AND ITS OFFICERS,
              DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
              LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR RELATED
              TO YOUR USE OF THE SERVICE.
            </p>
            <p className="text-gray-300 leading-relaxed">
              OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED
              THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              10. Indemnification
            </h2>
            <p className="text-gray-300 leading-relaxed">
              You agree to indemnify, defend, and hold harmless Youth Coach Hub LLC and its
              officers, directors, employees, and agents from any claims, damages, losses,
              liabilities, and expenses (including reasonable attorneys&apos; fees) arising out of
              or related to your use of the Service, Your Content, or your violation of these
              Terms.
            </p>
          </section>

          {/* Section 11 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              11. Governing Law and Dispute Resolution
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with the laws of
              the State of Utah, USA, without regard to its conflict of law provisions.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Any disputes arising under these Terms shall be resolved exclusively in the
              state or federal courts located in Salt Lake County, Utah, and you consent to
              the personal jurisdiction of such courts.
            </p>
          </section>

          {/* Section 12 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              12. Changes to Terms
            </h2>
            <p className="text-gray-300 leading-relaxed">
              We may update these Terms from time to time. We will notify you of material
              changes by email or by posting a notice on the Service at least 30 days before
              the changes take effect. Your continued use of the Service after the changes
              take effect constitutes acceptance of the new Terms.
            </p>
          </section>

          {/* Section 13 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              13. General Provisions
            </h2>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>
                <strong className="text-white">Entire Agreement:</strong> These Terms constitute the entire agreement
                between you and Youth Coach Hub LLC regarding the Service.
              </li>
              <li>
                <strong className="text-white">Severability:</strong> If any provision of these Terms is found to be
                unenforceable, the remaining provisions will remain in effect.
              </li>
              <li>
                <strong className="text-white">Waiver:</strong> Our failure to enforce any provision of these Terms
                shall not constitute a waiver of that provision.
              </li>
              <li>
                <strong className="text-white">Assignment:</strong> You may not assign these Terms without our prior
                written consent. We may assign these Terms without restriction.
              </li>
            </ul>
          </section>

          {/* Section 14 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              14. Contact Information
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="bg-[#1a1410]/60 backdrop-blur-md border border-white/20 rounded-xl p-6 shadow-xl shadow-black/30">
              <p className="text-gray-300">
                <strong className="text-white">Youth Coach Hub LLC</strong><br />
                <Link href="/contact" className="text-[#B8CA6E] hover:text-[#c9d88a] transition-colors">
                  Contact Form
                </Link><br />
                Website: youthcoachhub.com
              </p>
            </div>
          </section>
        </div>

      </div>

      {/* Footer */}
      <footer className="relative py-12 px-8 bg-[#1a1410] border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src="/logo-darkmode.png"
                alt="Youth Coach Hub"
                className="h-8 w-auto"
              />
              <span className="text-white font-semibold tracking-tight">
                youth<span className="text-[#B8CA6E]">coach</span>hub
              </span>
            </div>
            <div className="flex items-center gap-8">
              <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-sm">About</Link>
              <Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">Contact</Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy</Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors text-sm">Terms</Link>
            </div>
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Youth Coach Hub
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
