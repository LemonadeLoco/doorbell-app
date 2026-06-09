export function BottomNav({ screen, setScreen, sessionActive }) {
  const items = [
    { id: 'home',     label: 'Home',    icon: HomeIcon },
    { id: 'pipeline', label: 'Pipeline', icon: PipelineIcon },
    { id: 'runde',    label: sessionActive ? 'Aktiv' : 'RUNDE', icon: RundeIcon, center: true },
    { id: 'stats',    label: 'Stats',   icon: StatsIcon },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex items-end px-2 pb-safe">
      {items.map(item => {
        if (item.center) {
          return (
            <button
              key={item.id}
              onClick={() => setScreen('runde')}
              className="btn-press flex-1 flex flex-col items-center pb-3"
              style={{ marginBottom: '0px' }}
            >
              <div
                className="flex items-center justify-center w-14 h-10 rounded-full font-bold text-white text-xs -translate-y-3 shadow-lg"
                style={{ background: sessionActive ? '#10B981' : '#F59E0B' }}
              >
                {sessionActive ? '●' : '▲'}
              </div>
              <span
                className="text-xs font-semibold -mt-2"
                style={{ color: sessionActive ? '#10B981' : '#F59E0B' }}
              >
                {item.label}
              </span>
            </button>
          )
        }
        const active = screen === item.id
        return (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            className="btn-press flex-1 flex flex-col items-center py-3 gap-1"
          >
            <item.icon color={active ? '#F59E0B' : '#9CA3AF'} />
            <span
              className="text-xs font-semibold"
              style={{ color: active ? '#F59E0B' : '#9CA3AF' }}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function HomeIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}

function PipelineIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function RundeIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color} stroke="none">
      <polygon points="12,3 22,21 2,21"/>
    </svg>
  )
}

function StatsIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}
