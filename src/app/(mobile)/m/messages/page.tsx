'use client'

export default function MobileMessagesPage() {
  return (
    <div className="min-h-screen bg-[#f2f2f7] pb-8">
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <p className="text-sm text-gray-500">Coming soon</p>
        <p className="text-xs text-gray-400">Team messaging and parent communication</p>
      </div>
    </div>
  )
}
