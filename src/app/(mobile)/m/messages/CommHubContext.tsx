'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useMobile } from '@/app/(mobile)/MobileContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Announcement {
  id: string
  team_id: string
  sender_id: string
  sender_role: string
  title: string
  body: string
  priority: 'normal' | 'important' | 'urgent'
  notification_channel: string
  target_position_group: string | null
  attachments: unknown
  shared_video_id: string | null
  created_at: string
  updated_at: string
}

interface CommHubContextType {
  planTier: string | null
  isPaid: boolean
  planLoading: boolean
  parentCount: number
  announcements: Announcement[]
  announcementsLoading: boolean
  refreshAnnouncements: () => void
  teamId: string | null
}

const CommHubContext = createContext<CommHubContextType>({
  planTier: null,
  isPaid: false,
  planLoading: true,
  parentCount: 0,
  announcements: [],
  announcementsLoading: true,
  refreshAnnouncements: () => {},
  teamId: null,
})

export const useCommHub = () => useContext(CommHubContext)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const PAID_TIERS = new Set(['varsity', 'all_conference', 'all_state'])

export function CommHubProvider({ children }: { children: ReactNode }) {
  const { teamId } = useMobile()

  const [planTier, setPlanTier] = useState<string | null>(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [parentCount, setParentCount] = useState(0)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(true)

  // Fetch plan status
  useEffect(() => {
    if (!teamId) { setPlanLoading(false); return }

    fetch(`/api/communication/plan/status?teamId=${teamId}`)
      .then(res => res.json())
      .then(data => {
        if (data.plan) {
          setPlanTier(data.plan.plan_tier)
          setParentCount(data.plan.parent_count ?? 0)
        }
        setPlanLoading(false)
      })
      .catch(() => setPlanLoading(false))
  }, [teamId])

  // Fetch announcements
  const refreshAnnouncements = useCallback(() => {
    if (!teamId) return
    setAnnouncementsLoading(true)
    fetch(`/api/communication/announcements?teamId=${teamId}`)
      .then(res => res.json())
      .then(data => {
        if (data.announcements) setAnnouncements(data.announcements)
        setAnnouncementsLoading(false)
      })
      .catch(() => setAnnouncementsLoading(false))
  }, [teamId])

  useEffect(() => { refreshAnnouncements() }, [refreshAnnouncements])

  const isPaid = PAID_TIERS.has(planTier ?? '')

  return (
    <CommHubContext.Provider value={{
      planTier,
      isPaid,
      planLoading,
      parentCount,
      announcements,
      announcementsLoading,
      refreshAnnouncements,
      teamId,
    }}>
      {children}
    </CommHubContext.Provider>
  )
}
