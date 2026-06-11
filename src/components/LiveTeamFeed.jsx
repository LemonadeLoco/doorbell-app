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
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Live</p>
      <div
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {activeSessions.map(s => {
          const durMs   = now - new Date(s.started_at).getTime()
          const isStale = durMs > 8 * 3600000
          const duration = formatDuration(s.started_at, now)
          return (
            <div
              key={s.id}
              className="flex-shrink-0 bg-white rounded-2xl p-4 shadow-sm"
              style={{ borderLeft: `4px solid ${s.color}`, minWidth: 168 }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="font-bold text-gray-900 text-sm">{s.displayName}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{s.gebiet || '—'}</p>
              <p className="text-sm font-semibold text-gray-700">
                {s.doors} Türen · {s.termine} Termine
              </p>
              <p className="text-xs text-gray-400 mt-1">
                seit {duration}
                {isStale && <span className="text-gray-300 ml-1">(gestern?)</span>}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
