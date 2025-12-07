'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      // Successfully logged in - determine where to route the user
      const user = data.user
      const selectedTier = user?.user_metadata?.selected_tier

      // Check if user needs to complete checkout (paid tier, no team yet)
      if (selectedTier && selectedTier !== 'basic') {
        // Check if user already has a team (completed setup)
        const { data: teams } = await supabase
          .from('teams')
          .select('id')
          .eq('user_id', user?.id)
          .limit(1)

        if (!teams || teams.length === 0) {
          // No team yet - send to checkout for paid tier
          router.push(`/checkout?tier=${selectedTier}`)
          router.refresh()
          return
        }
      }

      // Check for explicit redirect destination
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        {/* Success banner from email confirmation */}
        {message && messageType === 'success' && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {message}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
          {/* Error message */}
          {message && messageType === 'error' && (
            <div className="text-sm text-red-600">
              {message}
            </div>
          )}

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link
                href="/pricing"
                className="text-gray-900 font-medium underline hover:no-underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

// Loading fallback
function LoginLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
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