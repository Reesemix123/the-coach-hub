'use client'

import { useState } from 'react'
import { CommHubProvider, type Announcement, type ParentWithChildren } from './CommHubContext'
import { type ConversationSummary } from './CommHubContext'
import AnnouncementDetail from './announcements/AnnouncementDetail'
import { useCommHub } from './CommHubContext'
import CalendarList, { type TeamEvent } from './calendar/CalendarList'
import NewEventSheet from './calendar/NewEventSheet'
import EventDetail from './calendar/EventDetail'
import ParentList from './parents/ParentList'
import InviteParentSheet from './parents/InviteParentSheet'
import ParentDetail from './parents/ParentDetail'
import MessageInbox from './messaging/MessageInbox'
import ComposeSheet from './messaging/ComposeSheet'
import ThreadView from './messaging/ThreadView'

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
// Messages Page Content (inside CommHubProvider)
// ---------------------------------------------------------------------------

function MessagesPageContent() {
  const [section, setSection] = useState<Section>('messages')
  const [showCompose, setShowCompose] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [selectedThread, setSelectedThread] = useState<ConversationSummary | null>(null)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<TeamEvent | null>(null)
  const [calendarKey, setCalendarKey] = useState(0)
  const [selectedParent, setSelectedParent] = useState<ParentWithChildren | null>(null)
  const [showInviteParent, setShowInviteParent] = useState(false)
  const { refreshAnnouncements, refreshParents, refreshConversations } = useCommHub()

  // If viewing announcement detail, render that instead of the inbox
  if (selectedAnnouncement) {
    return (
      <AnnouncementDetail
        announcement={selectedAnnouncement}
        onBack={() => setSelectedAnnouncement(null)}
      />
    )
  }

  // If viewing a direct message thread, render that instead of the inbox
  if (selectedThread && section === 'messages') {
    return (
      <ThreadView
        conversation={selectedThread}
        onBack={() => setSelectedThread(null)}
      />
    )
  }

  // If viewing parent detail, render that instead of the parent list
  if (selectedParent && section === 'parents') {
    return (
      <ParentDetail
        parent={selectedParent}
        onBack={() => setSelectedParent(null)}
        onChanged={() => { setSelectedParent(null); refreshParents() }}
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
                  ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                  : 'bg-[var(--bg-card-alt)] text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Section content */}
      {section === 'messages' && (
        <>
          <MessageInbox
            onSelectAnnouncement={setSelectedAnnouncement}
            onSelectThread={setSelectedThread}
            onCompose={() => setShowCompose(true)}
            isActive={section === 'messages'}
          />
          {showCompose && (
            <ComposeSheet
              onClose={() => setShowCompose(false)}
              onSent={() => {
                setShowCompose(false)
                refreshAnnouncements()
                refreshConversations()
              }}
            />
          )}
        </>
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
        <>
          <ParentList
            onSelectParent={setSelectedParent}
            onSelectInvite={() => {}} // TODO: invite detail view
            onInvite={() => setShowInviteParent(true)}
          />
          {showInviteParent && (
            <InviteParentSheet
              onClose={() => setShowInviteParent(false)}
              onSent={() => { setShowInviteParent(false); refreshParents() }}
            />
          )}
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Page Export (wraps content in CommHubProvider)
// ---------------------------------------------------------------------------

export default function MobileMessagesPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      <div className="px-4 pt-12 pb-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Messages</h1>
      </div>

      <CommHubProvider>
        <MessagesPageContent />
      </CommHubProvider>
    </div>
  )
}
