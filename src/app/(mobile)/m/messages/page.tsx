'use client'

import { useState } from 'react'
import { CommHubProvider, type Announcement } from './CommHubContext'
import AnnouncementList from './announcements/AnnouncementList'
import ComposeAnnouncement from './announcements/ComposeAnnouncement'
import AnnouncementDetail from './announcements/AnnouncementDetail'
import { useCommHub } from './CommHubContext'

// ---------------------------------------------------------------------------
// Sub-nav sections
// ---------------------------------------------------------------------------

type Section = 'announcements' | 'chat' | 'calendar' | 'parents'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'announcements', label: 'Announcements' },
  { key: 'chat', label: 'Chat' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'parents', label: 'Parents' },
]

// ---------------------------------------------------------------------------
// Placeholder for future sections
// ---------------------------------------------------------------------------

function PlaceholderSection({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      {icon}
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Messages Page Content (inside CommHubProvider)
// ---------------------------------------------------------------------------

function MessagesPageContent() {
  const [section, setSection] = useState<Section>('announcements')
  const [showCompose, setShowCompose] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const { refreshAnnouncements } = useCommHub()

  // If viewing announcement detail, render that instead of the list
  if (selectedAnnouncement) {
    return (
      <AnnouncementDetail
        announcement={selectedAnnouncement}
        onBack={() => setSelectedAnnouncement(null)}
      />
    )
  }

  return (
    <>
      {/* Sub-navigation pills */}
      <div className="px-4 mt-2 mb-1">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                section === key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 active:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Section content */}
      {section === 'announcements' && (
        <AnnouncementList
          onSelectAnnouncement={setSelectedAnnouncement}
          onCompose={() => setShowCompose(true)}
        />
      )}

      {section === 'chat' && (
        <PlaceholderSection
          icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
          title="Direct messaging coming soon"
          subtitle="Chat with individual parents"
        />
      )}

      {section === 'calendar' && (
        <PlaceholderSection
          icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
          title="Team calendar coming soon"
          subtitle="Schedule events and track RSVPs"
        />
      )}

      {section === 'parents' && (
        <PlaceholderSection
          icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300"><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" /><circle cx="10" cy="7" r="4" /></svg>}
          title="Parent roster coming soon"
          subtitle="Manage parent invitations and contacts"
        />
      )}

      {/* Compose sheet */}
      {showCompose && (
        <ComposeAnnouncement
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false)
            refreshAnnouncements()
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Page Export (wraps content in CommHubProvider)
// ---------------------------------------------------------------------------

export default function MobileMessagesPage() {
  return (
    <div className="min-h-screen bg-[#f2f2f7] pb-8">
      <div className="px-4 pt-12 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>

      <CommHubProvider>
        <MessagesPageContent />
      </CommHubProvider>
    </div>
  )
}
