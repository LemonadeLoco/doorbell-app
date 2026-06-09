import { STATUSES, SOURCES } from '../lib/constants'

export function StatusBadge({ status }) {
  const s = STATUSES[status]
  if (!s) return null
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

export function SourceBadge({ source }) {
  const s = SOURCES[source]
  if (!s) return null
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}
