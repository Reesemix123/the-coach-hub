import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="relative py-12 px-8 bg-[#1a1410] border-t border-white/10">
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
            <Link href="/sms-policy" className="text-gray-400 hover:text-white transition-colors text-sm">SMS Policy</Link>
          </div>

          {/* Copyright */}
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Youth Coach Hub
          </p>
        </div>
      </div>
    </footer>
  );
}
