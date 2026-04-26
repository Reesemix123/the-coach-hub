'use client'

import { useState, type ReactNode } from 'react'
import { CommHubProvider, type Announcement } from './CommHubContext'
import AnnouncementList from './announcements/AnnouncementList'
import ComposeAnnouncement from './announcements/ComposeAnnouncement'
import AnnouncementDetail from './announcements/AnnouncementDetail'
import { useCommHub } from './CommHubContext'
import CalendarList, { type TeamEvent } from './calendar/CalendarList'
import NewEventSheet from './calendar/NewEventSheet'
import EventDetail from './calendar/EventDetail'

// ---------------------------------------------------------------------------
// Sub-nav sections
// ---------------------------------------------------------------------------

type Section = 'messages' | 'calendar' | 'parents'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'messages', label: 'Messages' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'parents', label: 'Parents' },
]

// ---------------------------------------------------------------------------
// Placeholder for future sections
// ---------------------------------------------------------------------------

function PlaceholderSection({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
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
  const [section, setSection] = useState<Section>('messages')
  const [showCompose, setShowCompose] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<TeamEvent | null>(null)
  const [calendarKey, setCalendarKey] = useState(0)
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

  // If viewing event detail, render that instead of the calendar list
  if (selectedEvent && section === 'calendar') {
    return (
      <>
        <EventDetail
          event={selectedEvent}
          onBack={() => setSelectedEvent(null)}
          onEdit={() => { setEditingEvent(selectedEvent); setSelectedEvent(null) }}
          onDeleted={() => { setSelectedEvent(null); setCalendarKey(k => k + 1) }}
        />
        {editingEvent && (
          <NewEventSheet
            editingEvent={editingEvent}
            onClose={() => setEditingEvent(null)}
            onSaved={() => { setEditingEvent(null); setCalendarKey(k => k + 1) }}
          />
        )}
      </>
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
      {section === 'messages' && (
        <AnnouncementList
          onSelectAnnouncement={setSelectedAnnouncement}
          onCompose={() => setShowCompose(true)}
        />
      )}

      {section === 'calendar' && (
        <>
          <CalendarList
            key={calendarKey}
            onSelectEvent={setSelectedEvent}
            onNewEvent={() => setShowNewEvent(true)}
          />
          {showNewEvent && (
            <NewEventSheet
              onClose={() => setShowNewEvent(false)}
              onSaved={() => { setShowNewEvent(false); setCalendarKey(k => k + 1) }}
            />
          )}
        </>
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
