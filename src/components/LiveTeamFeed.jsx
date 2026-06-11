import { useEffect, useState } from 'react'
import { useActiveSessions } from '../hooks/useActiveSessions'

function formatDuration(startedAt, now) {
  const diffMs    = now - new Date(startedAt).getTime()
  const totalMins = Math.floor(diffMs / 60000)
  const hours     = Math.floor(totalMins / 60)
  const mins      = totalMins % 60
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins}min`
}

export function LiveTeamFeed() {
  const { activeSessions, loading } = useActiveSessions()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading || activeSessions.length === 0) return null

  return (
    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="live-dot" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live</p>
      </div>
      <div className="flex flex-col gap-2">
        {activeSessions.map(s => {
          const durMs   = now - new Date(s.started_at).getTime()
          const isStale = durMs > 8 * 3600000
          const duration = formatDuration(s.started_at, now)
          return (
            <div key={s.id} className="flex items-center gap-2 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{s.displayName}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{s.gebiet || '—'}</span>
              <span className="text-gray-200 text-xs flex-shrink-0">·</span>
              <span className="text-xs text-gray-600 truncate">
                {s.doors} Türen · {s.termine} Termine · {duration}
                {isStale && <span className="text-gray-300 ml-1">(gestern?)</span>}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
