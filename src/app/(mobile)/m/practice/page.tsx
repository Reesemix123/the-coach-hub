'use client'

export default function MobilePracticePage() {
  return (
    <div className="min-h-screen bg-[#f2f2f7] pb-8">
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Practice</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
          <path d="M16 4H8a1 1 0 00-1 1v14a1 1 0 001 1h8a1 1 0 001-1V5a1 1 0 00-1-1z" />
          <path d="M12 2v2M9 9h6M9 12h6M9 15h3" />
        </svg>
        <p className="text-sm text-gray-500">Loading practice plans...</p>
      </div>
    </div>
  )
}
