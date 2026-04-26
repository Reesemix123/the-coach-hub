'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { SubscriptionTier, SubscriptionStatus } from '@/types/admin'
import type { PlanTier } from '@/types/communication'
import type { Feature } from '@/lib/feature-access'
import { canAccessFeature } from '@/lib/feature-access'
import { useMobile } from './MobileContext'
import { useRole } from './RoleContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionContextValue {
  // Coach subscription
  coachTier: SubscriptionTier | null
  coachStatus: SubscriptionStatus | null
  billingWaived: boolean

  // Comm Hub plan
  commPlan: PlanTier | null

  // Parent access
  parentHasAccess: boolean
  parentAccessSource: 'comm_hub' | 'self_subscribed' | 'none' | null

  // Helpers
  loading: boolean
  canAccess: (feature: Feature) => boolean
  refetch: () => Promise<void>
}

const defaults: SubscriptionContextValue = {
  coachTier: null,
  coachStatus: null,
  billingWaived: false,
  commPlan: null,
  parentHasAccess: false,
  parentAccessSource: null,
  loading: true,
  canAccess: () => false,
  refetch: async () => {},
}

const SubscriptionContext = createContext<SubscriptionContextValue>(defaults)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SubscriptionProviderProps {
  children: ReactNode
  athleteId?: string | null
}

export function SubscriptionProvider({ children, athleteId }: SubscriptionProviderProps) {
  const { teamId } = useMobile()
  const { activeRole } = useRole()

  const [coachTier, setCoachTier] = useState<SubscriptionTier | null>(null)
  const [coachStatus, setCoachStatus] = useState<SubscriptionStatus | null>(null)
  const [billingWaived, setBillingWaived] = useState(false)
  const [commPlan, setCommPlan] = useState<PlanTier | null>(null)
  const [parentHasAccess, setParentHasAccess] = useState(false)
  const [parentAccessSource, setParentAccessSource] = useState<'comm_hub' | 'self_subscribed' | 'none' | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSubscription = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (teamId) params.set('teamId', teamId)
      if (athleteId) params.set('athleteId', athleteId)

      const res = await fetch(`/api/mobile/subscription?${params}`)
      if (!res.ok) throw new Error('Failed to fetch subscription')

      const data = await res.json()
      setCoachTier(data.coachTier)
      setCoachStatus(data.coachStatus)
      setBillingWaived(data.billingWaived)
      setCommPlan(data.commPlan)
      setParentHasAccess(data.parentHasAccess)
      setParentAccessSource(data.parentAccessSource)
    } catch (err) {
      console.error('[SubscriptionContext] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [teamId, athleteId])

  // Re-fetch when teamId or activeRole changes
  useEffect(() => { fetchSubscription() }, [fetchSubscription, activeRole])

  const canAccessFn = useCallback(
    (feature: Feature): boolean => {
      if (!coachTier || !coachStatus) return false
      return canAccessFeature(feature, {
        tier: coachTier,
        status: coachStatus,
        billing_waived: billingWaived,
      })
    },
    [coachTier, coachStatus, billingWaived]
  )

  return (
    <SubscriptionContext.Provider
      value={{
        coachTier,
        coachStatus,
        billingWaived,
        commPlan,
        parentHasAccess,
        parentAccessSource,
        loading,
        canAccess: canAccessFn,
        refetch: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useSubscription = () => useContext(SubscriptionContext)
