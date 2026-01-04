// src/app/privacy/page.tsx
// LEGAL NOTICE: This Privacy Policy is a template and should be reviewed
// by a qualified attorney before commercial launch. This document is provided
// as a starting point and may not cover all legal requirements for your
// specific jurisdiction or business needs, including GDPR, CCPA, or other
// applicable privacy regulations.

import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Youth Coach Hub',
  description: 'Privacy Policy for Youth Coach Hub - How we collect, use, and protect your data.',
};

export default function PrivacyPage() {
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
          <Link href="/auth/signup" className="hidden sm:flex h-12 px-5 bg-[#B8CA6E] text-[#1a1410] font-black rounded-2xl hover:bg-[#c9d88a] transition-colors text-sm items-center justify-center" style={{ boxShadow: '0 14px 28px rgba(184,202,110,.25)' }}>
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
            Privacy Policy
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
              Youth Coach Hub LLC (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use the Youth Coach Hub website,
              applications, and services (collectively, the &quot;Service&quot;).
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              By using the Service, you consent to the data practices described in this
              Privacy Policy. If you do not agree with our policies and practices, please
              do not use the Service.
            </p>
          </section>

          {/* Section 1 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              1. Information We Collect
            </h2>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              1.1 Information You Provide
            </h3>
            <p className="text-gray-300 leading-relaxed mb-2">
              We collect information you voluntarily provide when using the Service:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>
                <strong className="text-white">Account Information:</strong> Name, email address, password, and
                profile information when you create an account
              </li>
              <li>
                <strong className="text-white">Team Information:</strong> Team name, roster data, player names,
                jersey numbers, and positions
              </li>
              <li>
                <strong className="text-white">Video Content:</strong> Game film, practice footage, and other
                video files you upload
              </li>
              <li>
                <strong className="text-white">Playbook Data:</strong> Play diagrams, formations, and play
                attributes you create
              </li>
              <li>
                <strong className="text-white">Analytics Data:</strong> Play tags, game statistics, and
                performance metrics you input
              </li>
              <li>
                <strong className="text-white">Payment Information:</strong> Billing address and payment method
                details (processed securely by Stripe)
              </li>
              <li>
                <strong className="text-white">Communications:</strong> Messages you send to us for support or
                feedback
              </li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              1.2 Information Collected Automatically
            </h3>
            <p className="text-gray-300 leading-relaxed mb-2">
              When you use the Service, we automatically collect certain information:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>
                <strong className="text-white">Usage Data:</strong> Pages visited, features used, actions taken,
                and time spent on the Service
              </li>
              <li>
                <strong className="text-white">Device Information:</strong> Device type, operating system, browser
                type, and unique device identifiers
              </li>
              <li>
                <strong className="text-white">Log Data:</strong> IP address, access times, referring URLs, and
                error logs
              </li>
              <li>
                <strong className="text-white">Location Data:</strong> General geographic location based on IP
                address (not precise location)
              </li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              1.3 Cookies and Similar Technologies
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We use cookies and similar tracking technologies to collect and store
              information about your preferences and activity. You can control cookies
              through your browser settings, but disabling cookies may affect the
              functionality of the Service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              2. How We Use Your Information
            </h2>
            <p className="text-gray-300 leading-relaxed mb-2">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process your subscription and payments</li>
              <li>Store and display your team data, videos, and playbooks</li>
              <li>Generate analytics and insights based on your data</li>
              <li>Send you service-related communications (account updates, security alerts)</li>
              <li>Respond to your support requests and inquiries</li>
              <li>Detect, prevent, and address technical issues and abuse</li>
              <li>Enforce our Terms of Service and other policies</li>
              <li>Comply with legal obligations</li>
              <li>Train and improve our AI features and machine learning models using anonymized,
                  aggregated data that cannot be linked back to you or your team</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              We use aggregated, anonymized data for research, analytics, and AI model improvement
              purposes. This data is de-identified and cannot be used to identify you or your team.
              See Section 5 for more details on data retention for AI training purposes.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              3. Third-Party Services and Data Sharing
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We share your information with third-party service providers who help us
              operate the Service. These providers are contractually obligated to protect
              your information and use it only for the purposes we specify:
            </p>

            <div className="bg-[#1a1410]/60 backdrop-blur-md border border-white/20 rounded-xl p-6 mb-4 shadow-xl shadow-black/30">
              <h4 className="font-semibold text-white mb-4">Our Service Providers:</h4>
              <ul className="space-y-4 text-gray-300">
                <li>
                  <strong className="text-white">Supabase</strong> (supabase.com)<br />
                  <span className="text-sm text-gray-400">
                    Database hosting, user authentication, and file storage. Your account
                    data, team information, and uploaded videos are stored on Supabase&apos;s
                    secure infrastructure.
                  </span>
                </li>
                <li>
                  <strong className="text-white">Stripe</strong> (stripe.com)<br />
                  <span className="text-sm text-gray-400">
                    Payment processing. We do not store your complete credit card number.
                    Stripe handles all payment data in compliance with PCI-DSS standards.
                  </span>
                </li>
                <li>
                  <strong className="text-white">Resend</strong> (resend.com)<br />
                  <span className="text-sm text-gray-400">
                    Email delivery for transactional emails (account verification,
                    password resets, billing notifications).
                  </span>
                </li>
                <li>
                  <strong className="text-white">Vercel</strong> (vercel.com)<br />
                  <span className="text-sm text-gray-400">
                    Web hosting and content delivery. Serves our application and static
                    content globally.
                  </span>
                </li>
              </ul>
            </div>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              3.1 Other Disclosures
            </h3>
            <p className="text-gray-300 leading-relaxed mb-2">
              We may also disclose your information:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>
                <strong className="text-white">Legal Requirements:</strong> When required by law, court order,
                or government request
              </li>
              <li>
                <strong className="text-white">Safety and Security:</strong> To protect the rights, property, or
                safety of Youth Coach Hub, our users, or others
              </li>
              <li>
                <strong className="text-white">Business Transfers:</strong> In connection with a merger,
                acquisition, or sale of assets (you will be notified)
              </li>
              <li>
                <strong className="text-white">With Your Consent:</strong> When you explicitly authorize us to
                share information
              </li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              3.2 What We Don&apos;t Do
            </h3>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>We do not sell your personal information to third parties</li>
              <li>We do not share your videos or playbooks with other teams or coaches</li>
              <li>We do not use your data for targeted advertising</li>
              <li>We do not provide your email to marketing partners</li>
              <li>We do not share identifiable data with third parties for their AI training
                  (we only use anonymized data internally to improve our own AI features)</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              4. Data Storage and Security
            </h2>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              4.1 Where Your Data Is Stored
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Your data is stored on secure servers operated by Supabase, primarily
              located in the United States. By using the Service, you consent to the
              transfer and storage of your data in the United States.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              4.2 Security Measures
            </h3>
            <p className="text-gray-300 leading-relaxed mb-2">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>Encryption of data in transit (HTTPS/TLS)</li>
              <li>Encryption of data at rest</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>Row-level security policies to isolate team data</li>
              <li>Regular security audits and updates</li>
              <li>Two-factor authentication (optional)</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              While we strive to protect your information, no method of transmission or
              storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              5. Data Retention
            </h2>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              5.1 Active Accounts
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Your data is retained for as long as your account has an active subscription.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              5.2 After Subscription Ends
            </h3>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>
                <strong className="text-white">Grace Period (30 days):</strong> After your subscription ends, your data
                remains accessible if you resubscribe within 30 days
              </li>
              <li>
                <strong className="text-white">After Grace Period:</strong> Your data is no longer accessible through
                the Service, but is retained on our servers
              </li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              5.3 Data Retention for AI Improvement
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Your Content (playbooks, play tags, analytics data) is retained indefinitely in
              anonymized, aggregated form for the purpose of improving our AI and analytics features.
              This data is de-identified and cannot be used to identify you or your team. See our
              Terms of Service (Section 5.2) for details on the AI training license.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              5.4 Right to Deletion
            </h3>
            <p className="text-gray-300 leading-relaxed">
              You may request permanent deletion of your data by contacting us through our contact form.
              Upon request, we will delete your personal information within 30 days. Note that
              anonymized data that has already been incorporated into our AI training datasets cannot
              be removed, as it is no longer identifiable.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              5.5 Backup Retention
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Backups may be retained for up to 90 days for disaster recovery purposes.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              5.6 Legal Requirements
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We may retain certain data longer if required by law or to protect our legal interests.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              6. Your Rights and Choices
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              You have the following rights regarding your personal information:
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              6.1 Access and Portability
            </h3>
            <p className="text-gray-300 leading-relaxed">
              You can access most of your data directly through your account settings.
              You may request a complete export of your data by contacting us. We will
              provide your data in a commonly used format within 30 days.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              6.2 Correction
            </h3>
            <p className="text-gray-300 leading-relaxed">
              You can update your account information at any time through your account
              settings. For corrections to other data, contact us and we will make the
              necessary updates.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              6.3 Deletion
            </h3>
            <p className="text-gray-300 leading-relaxed">
              You can delete your account through your account settings or by contacting
              us. Upon deletion, we will remove your personal information within 30 days,
              except as required by law.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              6.4 Communication Preferences
            </h3>
            <p className="text-gray-300 leading-relaxed">
              You can opt out of promotional emails by clicking &quot;unsubscribe&quot; in any
              marketing email. Note that you cannot opt out of service-related
              communications (billing, security alerts, account notifications).
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              7. Children&apos;s Privacy
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Youth Coach Hub is designed for coaches, not for use by children. Our
              policies regarding minors are as follows:
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              7.1 Age Requirements
            </h3>
            <p className="text-gray-300 leading-relaxed">
              You must be at least 18 years old to create an account. Users between 13
              and 18 may use the Service only with parental or guardian consent and
              supervision.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              7.2 Player Information
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Coaches may enter basic player information (names, jersey numbers, positions)
              for team management purposes. This information is used solely for coaching
              purposes and is not shared outside the team. Coaches are responsible for
              ensuring they have appropriate consent to enter player information.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              7.3 Video Content
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Videos uploaded to the Service may contain images of minors participating
              in football. This content is stored securely, accessible only to authorized
              team members, and used solely for coaching purposes.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              7.4 COPPA Compliance
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We do not knowingly collect personal information directly from children
              under 13. If you believe a child under 13 has provided us with personal
              information, please contact us immediately and we will delete such information.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              8. Cookies and Tracking Technologies
            </h2>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              8.1 Types of Cookies We Use
            </h3>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>
                <strong className="text-white">Essential Cookies:</strong> Required for the Service to function
                (authentication, security, preferences)
              </li>
              <li>
                <strong className="text-white">Analytics Cookies:</strong> Help us understand how users interact
                with the Service to improve functionality
              </li>
              <li>
                <strong className="text-white">Performance Cookies:</strong> Used to optimize page load times
                and Service performance
              </li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              8.2 Managing Cookies
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Most browsers allow you to control cookies through settings. You can block
              or delete cookies, but this may affect your ability to use certain features
              of the Service. For more information, consult your browser&apos;s help documentation.
            </p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">
              8.3 Do Not Track
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We do not currently respond to &quot;Do Not Track&quot; signals because there is no
              industry standard for handling such signals. We do not track users across
              third-party websites.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              9. California Privacy Rights (CCPA)
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you are a California resident, you have additional rights under the
              California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>
                <strong className="text-white">Right to Know:</strong> You can request details about the categories
                and specific pieces of personal information we collect
              </li>
              <li>
                <strong className="text-white">Right to Delete:</strong> You can request deletion of your personal
                information
              </li>
              <li>
                <strong className="text-white">Right to Opt-Out:</strong> You can opt out of the &quot;sale&quot; of personal
                information (we do not sell personal information)
              </li>
              <li>
                <strong className="text-white">Right to Non-Discrimination:</strong> We will not discriminate against
                you for exercising your privacy rights
              </li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              To exercise these rights, contact us through our contact form or use
              the &quot;Privacy&quot; section in your account settings.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              10. International Users
            </h2>
            <p className="text-gray-300 leading-relaxed">
              Youth Coach Hub is operated in the United States. If you are accessing the
              Service from outside the United States, please be aware that your information
              will be transferred to, stored, and processed in the United States. By using
              the Service, you consent to this transfer. The data protection laws in the
              United States may differ from those in your country.
            </p>
          </section>

          {/* Section 11 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              11. Changes to This Privacy Policy
            </h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of
              material changes by email or by posting a prominent notice on the Service at
              least 30 days before the changes take effect. We encourage you to review this
              Privacy Policy periodically. Your continued use of the Service after the
              changes take effect constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Section 12 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              12. Contact Us
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you have questions, concerns, or requests regarding this Privacy Policy
              or our data practices, please contact us:
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
            <p className="text-gray-300 leading-relaxed mt-4">
              We will respond to your inquiry within 30 days.
            </p>
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
