'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface MobileAuthGuardProps {
  children: ReactNode
}

export function MobileAuthGuard({ children }: MobileAuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  // Auth pages bypass the guard entirely
  const isAuthPage = pathname.startsWith('/m/auth')

  useEffect(() => {
    if (isAuthPage) {
      setChecked(true)
      return
    }

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        router.replace(`/m/auth?redirectedFrom=${encodeURIComponent(pathname)}`)
      } else {
        setChecked(true)
      }
    })

    // Listen for sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/m/auth')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, pathname, isAuthPage])

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo-darkmode.png" className="w-10 h-10 object-contain opacity-50" alt="" />
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
