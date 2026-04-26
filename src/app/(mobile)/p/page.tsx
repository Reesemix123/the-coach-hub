'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Parent home — redirects to the Schedule tab */
export default function ParentHomePage() {
  const router = useRouter()
  useEffect(() => { router.replace('/p/schedule') }, [router])
  return null
}
