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

export interface ParentChild {
  player_id: string
  player_name: string
  jersey_number: string | null
  relationship: string
  is_primary_contact: boolean
}

export interface ParentProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  notification_preference: string
  is_champion: boolean
  created_at: string
}

export interface ParentWithChildren {
  parent: ParentProfile
  children: ParentChild[]
}

export interface PendingInvite {
  id: string
  team_id: string
  player_id: string
  parent_email: string
  status: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PARENT_LIMITS: Record<string, number | null> = {
  sideline: 20,
  rookie: 20,
  varsity: 40,
  all_conference: 60,
  all_state: null, // unlimited
}

interface CommHubContextType {
  planTier: string | null
  isPaid: boolean
  planLoading: boolean
  parentCount: number
  parentLimit: number | null
  announcements: Announcement[]
  announcementsLoading: boolean
  refreshAnnouncements: () => void
  parents: ParentWithChildren[]
  pendingInvites: PendingInvite[]
  parentsLoading: boolean
  refreshParents: () => void
  teamId: string | null
}

const CommHubContext = createContext<CommHubContextType>({
  planTier: null,
  isPaid: false,
  planLoading: true,
  parentCount: 0,
  parentLimit: 20,
  announcements: [],
  announcementsLoading: true,
  refreshAnnouncements: () => {},
  parents: [],
  pendingInvites: [],
  parentsLoading: true,
  refreshParents: () => {},
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
  const [parents, setParents] = useState<ParentWithChildren[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [parentsLoading, setParentsLoading] = useState(true)

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

  // Fetch parents + pending invitations
  const refreshParents = useCallback(() => {
    if (!teamId) return
    setParentsLoading(true)
    Promise.all([
      fetch(`/api/communication/parents?teamId=${teamId}`).then(r => r.json()),
      fetch(`/api/communication/parents/invite?teamId=${teamId}`).then(r => r.json()),
    ])
      .then(([parentsData, invitesData]) => {
        if (parentsData.parents) setParents(parentsData.parents)
        if (invitesData.invitations) setPendingInvites(invitesData.invitations)
        // Update parent count from actual data
        setParentCount((parentsData.parents?.length ?? 0) + (invitesData.invitations?.length ?? 0))
        setParentsLoading(false)
      })
      .catch(() => setParentsLoading(false))
  }, [teamId])

  useEffect(() => { refreshParents() }, [refreshParents])

  const isPaid = PAID_TIERS.has(planTier ?? '')
  const parentLimit = PARENT_LIMITS[planTier ?? 'rookie'] ?? null

  return (
    <CommHubContext.Provider value={{
      planTier,
      isPaid,
      planLoading,
      parentCount,
      parentLimit,
      announcements,
      announcementsLoading,
      refreshAnnouncements,
      parents,
      pendingInvites,
      parentsLoading,
      refreshParents,
      teamId,
    }}>
      {children}
    </CommHubContext.Provider>
  )
}
