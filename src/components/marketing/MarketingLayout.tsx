/**
 * MarketingLayout
 *
 * Wraps marketing pages with the Friday Night Lights theme.
 * Handles the background image, overlay, and consistent section spacing.
 *
 * Usage:
 * <MarketingLayout>
 *   <Hero />
 *   <FeatureGrid />
 *   ...
 * </MarketingLayout>
 */

'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import '@/styles/marketing-theme.css';

interface MarketingLayoutProps {
  children: ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Navigation */}
      <MarketingNav />

      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}

function MarketingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0F172A]/80 backdrop-blur-md border-b border-white/5">
      <div className="marketing-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-darkmode.png"
              alt="Youth Coach Hub"
              width={36}
              height={36}
              className="w-9 h-9"
            />
            <span className="text-white font-semibold text-lg tracking-tight">
              youth<span className="text-[#A3E635]">coach</span>hub
            </span>
          </Link>

          {/* Center Links - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/#features"
              className="text-[rgba(249,250,251,0.72)] hover:text-white transition-colors text-sm"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-[rgba(249,250,251,0.72)] hover:text-white transition-colors text-sm"
            >
              Pricing
            </Link>
            <Link
              href="/about"
              className="text-[rgba(249,250,251,0.72)] hover:text-white transition-colors text-sm"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="text-[rgba(249,250,251,0.72)] hover:text-white transition-colors text-sm"
            >
              Contact
            </Link>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-[rgba(249,250,251,0.72)] hover:text-white transition-colors text-sm hidden sm:block"
            >
              Log In
            </Link>
            <Link
              href="/auth/signup"
              className="marketing-btn-primary !py-2 !px-5 !text-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-[#0F172A] border-t border-[rgba(148,163,184,0.18)]">
      <div className="marketing-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <Image
                src="/logo-darkmode.png"
                alt="Youth Coach Hub"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="text-white font-semibold tracking-tight">
                youth<span className="text-[#A3E635]">coach</span>hub
              </span>
            </Link>
            <p className="text-[rgba(249,250,251,0.56)] text-sm leading-relaxed">
              The all-in-one platform for youth football coaches to build playbooks,
              analyze film, and develop players.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#features" className="text-[rgba(249,250,251,0.56)] hover:text-white text-sm transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-[rgba(249,250,251,0.56)] hover:text-white text-sm transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-[rgba(249,250,251,0.56)] hover:text-white text-sm transition-colors">
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Support</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/contact" className="text-[rgba(249,250,251,0.56)] hover:text-white text-sm transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-[rgba(249,250,251,0.56)] hover:text-white text-sm transition-colors">
                  Help Center
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-[rgba(249,250,251,0.56)] hover:text-white text-sm transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[rgba(249,250,251,0.56)] hover:text-white text-sm transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-[rgba(148,163,184,0.18)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[rgba(249,250,251,0.56)] text-sm">
            &copy; {new Date().getFullYear()} Youth Coach Hub. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[rgba(249,250,251,0.56)] hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[rgba(249,250,251,0.56)] hover:text-white transition-colors"
              aria-label="YouTube"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
