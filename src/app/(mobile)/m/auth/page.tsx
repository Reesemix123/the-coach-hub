'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Mode = 'signin' | 'signup'

export default function MobileAuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectedFrom') || '/m/auth/route'

  const [mode, setMode] = useState<Mode>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    if (mode === 'signin') {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Incorrect email or password'
          : authError.message)
        setLoading(false)
        return
      }

      // Update activity
      try { await fetch('/api/user/activity', { method: 'POST' }) } catch {}

      router.replace(redirectTo)
    } else {
      // Create account — coaches start on Basic, no tier selection on mobile
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || null },
        },
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      // If email confirmation required (no session returned)
      if (!data.session) {
        setError('Check your email to confirm your account, then sign in.')
        setMode('signin')
        setLoading(false)
        return
      }

      // Signed up and auto-confirmed — route to persona router
      router.replace('/m/auth/route')
    }
  }

  function handleForgotPassword() {
    // Open desktop forgot-password page in system browser
    window.open('/auth/forgot-password', '_blank', 'noopener')
  }

  return (
    <div className="flex flex-col items-center px-6 pt-[env(safe-area-inset-top)]">
      {/* Logo + branding */}
      <div className="flex flex-col items-center pt-16 pb-8">
        <img
          src="/logo-darkmode.png"
          className="w-16 h-16 object-contain mb-4"
          alt="Youth Coach Hub"
        />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Youth Coach Hub</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Your sideline command center</p>
      </div>

      {/* Mode toggle */}
      <div className="flex bg-[var(--bg-pill-inactive)] rounded-lg p-0.5 w-full max-w-sm mb-6">
        {(['signin', 'signup'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null) }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors ${
              mode === m
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {m === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Coach Smith"
              autoComplete="name"
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="coach@example.com"
            autoComplete="email"
            required
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'signup' ? 6 : undefined}
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-[var(--status-error)] text-center">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && (
            <div className="w-4 h-4 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
          )}
          {mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>

        {/* Forgot password (sign in only) */}
        {mode === 'signin' && (
          <button
            type="button"
            onClick={handleForgotPassword}
            className="w-full text-center text-sm text-[var(--text-secondary)] py-2 active:text-[var(--text-primary)]"
          >
            Forgot password?
          </button>
        )}
      </form>

      {/* Footer hint */}
      <p className="text-xs text-[var(--text-tertiary)] mt-8 text-center max-w-[280px]">
        {mode === 'signin'
          ? 'Parents: sign up at youthcoachhub.com using your invitation link.'
          : 'By creating an account, you agree to our Terms of Service.'}
      </p>
    </div>
  )
}
