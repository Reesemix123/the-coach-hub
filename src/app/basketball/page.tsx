export default function BasketballPage() {
  return (
    <div
      className="min-h-screen bg-[#1a1410] flex flex-col"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif" }}
    >
      <nav className="px-4 sm:px-8 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <img src="/logo-darkmode.png" alt="Youth Coach Hub" className="h-8 w-auto" />
      </nav>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-5xl">🏀</p>
          <h1 className="text-3xl font-black mt-4" style={{ color: '#F9FAFB' }}>
            Basketball
          </h1>
          <p className="text-base mt-2" style={{ color: 'rgba(249,250,251,0.60)' }}>
            Coming soon to Youth Coach Hub
          </p>
          <a
            href="/"
            className="inline-block text-sm mt-8"
            style={{ color: '#B8CA6E' }}
          >
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
