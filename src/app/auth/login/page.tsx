'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'error' | 'success'>('error')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const supabase = createClient()

  // Check for URL params (e.g., from email confirmation redirect)
  useEffect(() => {
    const urlMessage = searchParams.get('message')
    const urlType = searchParams.get('type')
    if (urlMessage) {
      setMessage(urlMessage)
      setMessageType(urlType === 'success' ? 'success' : 'error')
    }
  }, [searchParams])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setMessageType('error')
      setLoading(false)
    } else {
      // Successfully logged in - update activity timestamp
      try {
        await fetch('/api/user/activity', { method: 'POST' });
      } catch {
        // Don't block login if activity update fails
      }

      // Determine where to route the user
      const user = data.user

      // Check if user has a team
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user?.id)
        .limit(1)

      if (!teams || teams.length === 0) {
        // New user without a team - send to plan selection
        // Check if they already have a tier selected in metadata
        const selectedTier = user?.user_metadata?.selected_tier
        if (selectedTier && selectedTier !== 'basic') {
          // Has paid tier selected - go to checkout
          router.push(`/checkout?tier=${selectedTier}`)
        } else if (selectedTier === 'basic') {
          // Basic tier - go to setup
          router.push('/setup?tier=basic')
        } else {
          // No tier selected - go to plan selection
          router.push('/select-plan')
        }
        router.refresh()
        return
      }

      // Existing user with team - check for explicit redirect destination
      const next = searchParams.get('next')
      if (next) {
        router.push(next)
      } else {
        router.push('/')
      }
      router.refresh()
    }
  }

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
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 backdrop-blur-sm" style={{ background: 'rgba(26,20,16,.65)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo-darkmode.png"
            alt="Youth Coach Hub"
            className="h-10 w-auto"
          />
          <span className="text-white font-semibold text-lg tracking-tight">
            youth<span className="text-[#B8CA6E]">coach</span>hub
          </span>
        </Link>
        <div className="flex items-center gap-8">
          <Link href="/#features" className="text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Features</Link>
          <Link href="/pricing" className="text-[rgba(249,250,251,.72)] hover:text-white transition-colors text-sm font-bold">Pricing</Link>
          <Link href="/auth/signup" className="h-12 px-5 bg-[#B8CA6E] text-[#1a1410] font-black rounded-2xl hover:bg-[#c9d88a] transition-colors text-sm flex items-center justify-center" style={{ boxShadow: '0 14px 28px rgba(184,202,110,.25)' }}>
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-gray-300">
              Welcome back! Enter your credentials below.
            </p>
          </div>

          {/* Success banner from email confirmation */}
          {message && messageType === 'success' && (
            <div className="bg-[#B8CA6E]/10 border border-[#B8CA6E]/30 text-[#B8CA6E] px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
            <div className="rounded-2xl bg-[#1a1410]/60 backdrop-blur-md border border-white/20 p-6 space-y-5 shadow-xl shadow-black/40">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:border-[#B8CA6E] focus:ring-1 focus:ring-[#B8CA6E] focus:outline-none transition-colors"
                  placeholder="coach@school.edu"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-[#B8CA6E] hover:text-[#c9d88a] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:border-[#B8CA6E] focus:ring-1 focus:ring-[#B8CA6E] focus:outline-none transition-colors"
                  placeholder="Enter your password"
                />
                <div className="mt-3 flex items-center">
                  <input
                    id="show-password"
                    name="show-password"
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="h-4 w-4 bg-[#1a1410] border-white/20 rounded text-[#B8CA6E] focus:ring-[#B8CA6E] focus:ring-offset-0"
                  />
                  <label htmlFor="show-password" className="ml-2 text-sm text-gray-400">
                    Show password
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#B8CA6E] text-[#1a1410] font-semibold rounded-xl hover:bg-[#c9d88a] transition-all disabled:opacity-50 shadow-lg shadow-[#B8CA6E]/20"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>

            {/* Error message */}
            {message && messageType === 'error' && (
              <div className="text-sm text-red-400 text-center">
                {message}
              </div>
            )}

            {/* Sign Up Link */}
            <div className="text-center">
              <p className="text-sm text-gray-400">
                Don&apos;t have an account?{' '}
                <Link
                  href="/pricing"
                  className="text-[#B8CA6E] font-medium hover:text-[#c9d88a] transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </form>
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
  )
}

// Loading fallback
function LoginLoading() {
  return (
    <div className="min-h-screen bg-[#1a1410] flex items-center justify-center -mt-24">
      <div className="text-gray-400">Loading...</div>
    </div>
  )
}

// Export the page with Suspense boundary for useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  )
}
