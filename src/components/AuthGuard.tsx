'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
  /** Enable session tracking for device limits (default: true) */
  trackSession?: boolean
}

export default function AuthGuard({
  children,
  redirectTo = '/auth/login',
  trackSession = true
}: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const sessionRegistered = useRef(false)
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null)

  // Register session for device tracking
  const registerSession = async () => {
    if (!trackSession || sessionRegistered.current) return

    try {
      const response = await fetch('/api/user/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        sessionRegistered.current = true
        const data = await response.json()

        // Log if sessions were revoked due to device limit
        if (data.revoked_count > 0) {
          console.info(`Device limit enforced: ${data.revoked_count} older session(s) signed out`)
        }
      }
    } catch (error) {
      console.error('Failed to register session:', error)
    }
  }

  // Send heartbeat to update last activity
  const sendHeartbeat = async () => {
    if (!trackSession) return
    try {
      await fetch('/api/user/sessions', { method: 'PATCH' })
    } catch {
      // Silent fail for heartbeat
    }
  }

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
          console.error('Auth error:', error)
          router.push(redirectTo)
          return
        }

        if (!user) {
          router.push(redirectTo)
          return
        }

        setUser(user)

        // Register session after successful auth
        registerSession()

        // Setup heartbeat (every 5 minutes)
        if (trackSession) {
          heartbeatTimer.current = setInterval(sendHeartbeat, 5 * 60 * 1000)
        }
      } catch (error) {
        console.error('Unexpected auth error:', error)
        router.push(redirectTo)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          router.push(redirectTo)
        } else if (session?.user) {
          setUser(session.user)
          setLoading(false)
          // Re-register session on sign in
          if (event === 'SIGNED_IN') {
            sessionRegistered.current = false
            registerSession()
          }
        }
      }
    )

    // Handle tab visibility for heartbeat
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current)
      }
    }
  }, [supabase.auth, router, redirectTo, trackSession])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return <>{children}</>
}