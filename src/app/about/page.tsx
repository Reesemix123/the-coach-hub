import Link from "next/link";

export default function About() {
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

      {/* Hero Section */}
      <div className="relative z-10 max-w-4xl mx-auto px-8 py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Built by coaches, <span className="text-[#B8CA6E]">for coaches</span>
        </h1>
        <p className="text-xl text-gray-300 leading-relaxed">
          Youth Coach Hub was created to give youth and high school football coaches the same
          tools that college and pro teams use, without the complexity or cost.
        </p>
      </div>

      {/* Our Story */}
      <div className="relative z-10 max-w-4xl mx-auto px-8 py-12">
        <div className="bg-[#1a1410]/60 backdrop-blur-md border border-white/20 rounded-2xl p-8 md:p-12 shadow-xl shadow-black/30">
          <h2 className="text-2xl font-semibold text-white mb-6">Our Story</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              We started Youth Coach Hub because we saw coaches spending countless hours on
              spreadsheets, paper playbooks, and disconnected tools. There had to be a better way.
            </p>
            <p>
              Today, our platform helps coaches at every level build digital playbooks, analyze
              game film, and track player development—all in one place. Whether you&apos;re coaching
              little league or varsity, we give you the tools to prepare your team for success.
            </p>
            <p>
              We believe every player deserves a well-prepared coach, and every coach deserves
              tools that work as hard as they do.
            </p>
          </div>
        </div>
      </div>

      {/* What We Offer */}
      <div className="relative z-10 max-w-4xl mx-auto px-8 py-12">
        <h2 className="text-2xl font-semibold text-white mb-8 text-center">What We Offer</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#1a1410]/60 backdrop-blur-md border border-white/20 rounded-xl p-6 text-center shadow-xl shadow-black/30">
            <div className="w-12 h-12 bg-[#B8CA6E]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Digital Playbooks</h3>
            <p className="text-gray-400 text-sm">
              Build and organize plays with our intuitive drag-and-drop builder
            </p>
          </div>
          <div className="bg-[#1a1410]/60 backdrop-blur-md border border-white/20 rounded-xl p-6 text-center shadow-xl shadow-black/30">
            <div className="w-12 h-12 bg-[#B8CA6E]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Film Analysis</h3>
            <p className="text-gray-400 text-sm">
              Tag plays, track tendencies, and prepare for your next opponent
            </p>
          </div>
          <div className="bg-[#1a1410]/60 backdrop-blur-md border border-white/20 rounded-xl p-6 text-center shadow-xl shadow-black/30">
            <div className="w-12 h-12 bg-[#B8CA6E]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#B8CA6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Analytics</h3>
            <p className="text-gray-400 text-sm">
              Track performance metrics and make data-driven decisions
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 max-w-4xl mx-auto px-8 py-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          Ready to elevate your coaching?
        </h2>
        <p className="text-gray-300 mb-8">
          Join thousands of coaches who trust Youth Coach Hub to prepare their teams.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/pricing"
            className="px-8 py-4 bg-[#B8CA6E] text-[#1a1410] font-semibold rounded-xl hover:bg-[#c9d88a] transition-colors shadow-lg shadow-[#B8CA6E]/20"
          >
            View Pricing
          </Link>
          <Link
            href="/contact"
            className="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors border border-white/20"
          >
            Contact Us
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative py-12 px-8 bg-[#1a1410] border-t border-white/10 mt-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
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

            {/* Links */}
            <div className="flex items-center gap-8">
              <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-sm">About</Link>
              <Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">Contact</Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy</Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors text-sm">Terms</Link>
            </div>

            {/* Copyright */}
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Youth Coach Hub
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
