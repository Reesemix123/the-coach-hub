import { Metadata } from 'next';
import Link from 'next/link';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export const metadata: Metadata = {
  title: 'SMS Policy | Youth Coach Hub',
  description: 'SMS messaging opt-in policy and disclosure for Youth Coach Hub.',
};

export default function SmsPolicyPage() {
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
            className="text-sm text-gray-200 hover:text-[#B8CA6E] mb-4 inline-block transition-colors"
          >
            &larr; Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            SMS Messaging Policy
          </h1>
          <p className="mt-4 text-sm text-gray-300">
            Last updated: March 20, 2026
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none">
          {/* Introduction */}
          <section className="mb-16">
            <p className="text-gray-300 leading-relaxed">
              Youth Coach Hub LLC (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) uses SMS text messaging
              to send team notifications to parents and guardians who have opted in to
              receive them. This page explains how we collect consent, what messages we
              send, and how you can opt out at any time.
            </p>
          </section>

          {/* How You Opt In */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              How You Opt In
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              You opt in to receive SMS messages from Youth Coach Hub by completing all
              of the following steps:
            </p>
            <ol className="list-decimal pl-6 text-gray-300 space-y-3">
              <li>
                <strong className="text-white">Accepting a coach invitation:</strong> A
                coach on your child&apos;s team sends you an email invitation to join Youth
                Coach Hub. You click the invitation link to begin creating your parent
                account.
              </li>
              <li>
                <strong className="text-white">Providing your phone number:</strong> During
                account creation, you voluntarily enter your mobile phone number.
              </li>
              <li>
                <strong className="text-white">Selecting SMS notifications:</strong> You
                choose &quot;SMS only&quot; or &quot;Email and SMS&quot; as your notification preference.
                This is an affirmative opt-in — SMS is not selected by default.
              </li>
            </ol>
            <p className="text-gray-300 leading-relaxed mt-4">
              By selecting an SMS notification preference during account creation, you
              expressly consent to receive text messages from Youth Coach Hub at the
              mobile number you provided.
            </p>
          </section>

          {/* Types of Messages */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Types of Messages
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We send the following types of SMS notifications:
            </p>
            <ul className="list-disc pl-6 text-gray-300 space-y-2">
              <li>Team announcements from your child&apos;s coach</li>
              <li>Practice and game schedule updates</li>
              <li>Event reminders and RSVP notifications</li>
              <li>New video or game film shared by the coach</li>
              <li>Direct messages from the coaching staff</li>
              <li>Progress reports and game summaries</li>
            </ul>
          </section>

          {/* Message Frequency */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Message Frequency
            </h2>
            <p className="text-gray-300 leading-relaxed">
              Message frequency varies based on your child&apos;s team activity. During an
              active season, you may receive several messages per week. During the
              off-season, message frequency is minimal. We do not send marketing or
              promotional messages via SMS.
            </p>
          </section>

          {/* How to Opt Out */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              How to Opt Out
            </h2>
            <div className="bg-[#1a1410]/60 backdrop-blur-md border border-white/20 rounded-xl p-6 mb-4 shadow-xl shadow-black/30">
              <p className="text-gray-300 leading-relaxed">
                You can opt out of SMS messages at any time by:
              </p>
              <ul className="list-disc pl-6 text-gray-300 space-y-2 mt-3">
                <li>
                  <strong className="text-white">Replying STOP</strong> to any message you
                  receive from us
                </li>
                <li>
                  Changing your notification preference to &quot;Email only&quot; in your{' '}
                  <strong className="text-white">Account Settings</strong> within the app
                </li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-3">
                After opting out, you will receive a single confirmation message and no
                further SMS messages will be sent. You can opt back in at any time by
                updating your notification preference in your account settings.
              </p>
            </div>
          </section>

          {/* Cost */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Message and Data Rates
            </h2>
            <p className="text-gray-300 leading-relaxed">
              Message and data rates may apply depending on your mobile carrier and plan.
              Youth Coach Hub does not charge for SMS messages, but your carrier&apos;s
              standard messaging rates may apply.
            </p>
          </section>

          {/* Help */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Help
            </h2>
            <p className="text-gray-300 leading-relaxed">
              For help or questions about our SMS messaging, reply <strong className="text-white">HELP</strong> to
              any message or contact us through our{' '}
              <Link href="/contact" className="text-[#B8CA6E] hover:text-[#c9d88a] transition-colors">
                contact form
              </Link>.
            </p>
          </section>

          {/* Privacy */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Privacy
            </h2>
            <p className="text-gray-300 leading-relaxed">
              Your phone number is used solely for delivering team notifications you
              have opted in to receive. We do not sell, rent, or share your phone number
              with third parties for marketing purposes. For full details on how we
              handle your personal information, see our{' '}
              <Link href="/privacy" className="text-[#B8CA6E] hover:text-[#c9d88a] transition-colors">
                Privacy Policy
              </Link>.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Contact Us
            </h2>
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

      <MarketingFooter />
    </div>
  );
}
