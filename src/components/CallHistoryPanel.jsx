import { useAllCallAttempts } from '../hooks/useAllCallAttempts'
import { BottomSheet } from './BottomSheet'

const OUTCOME_STYLES = {
  erreicht:       { label: 'Erreicht',       bg: '#D1FAE5', text: '#065F46' },
  nicht_erreicht: { label: 'Nicht erreicht', bg: '#FEE2E2', text: '#991B1B' },
  mailbox:        { label: 'Mailbox',        bg: '#F3F4F6', text: '#374151' },
}

const RESULT_LABELS = {
  termin:         'Termin vereinbart',
  kein_int:       'Kein Interesse',
  spaeter:        'Wiedervorlage',
  falsche_nummer: 'Falsche Nummer',
  schon_kunde:    'Schon Kunde',
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function dayKey(iso) {
  if (!iso) return 'Unbekannt'
  return iso.split('T')[0]
}

function dayLabel(dateStr) {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today)     return 'Heute'
  if (dateStr === yesterday) return 'Gestern'
  return new Date(dateStr).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function groupByDay(attempts) {
  const groups = []
  const seen   = {}
  for (const a of attempts) {
    const key = dayKey(a.attempted_at)
    if (!seen[key]) {
      seen[key] = { key, label: dayLabel(key), items: [] }
      groups.push(seen[key])
    }
    seen[key].items.push(a)
  }
  return groups
}

function AttemptRow({ attempt, onContactClick }) {
  const outcome = OUTCOME_STYLES[attempt.outcome] ?? { label: attempt.outcome, bg: '#F3F4F6', text: '#374151' }
  const result  = attempt.result ? RESULT_LABELS[attempt.result] : null
  const name    = attempt.contacts?.name ?? 'Unbekannt'

  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0"
      onClick={() => onContactClick && attempt.contacts?.id && onContactClick(attempt.contacts)}
      style={onContactClick && attempt.contacts ? { cursor: 'pointer' } : {}}
    >
      {/* Outcome badge */}
      <span
        className="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg mt-0.5"
        style={{ background: outcome.bg, color: outcome.text }}
      >
        {outcome.label}
      </span>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-sm font-semibold text-gray-900 truncate">{name}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(attempt.attempted_at)}</span>
        </div>
        {result && (
          <span className="text-xs text-gray-500">{result}</span>
        )}
        {attempt.notes && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{attempt.notes}</p>
        )}
      </div>
    </div>
  )
}

export function CallHistoryPanel({ onClose, onContactClick }) {
  const { attempts, loading } = useAllCallAttempts()
  const groups = groupByDay(attempts)

  return (
    <BottomSheet onClose={onClose}>
      <div className="pb-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-gray-900">Anrufhistorie</h2>
          {!loading && (
            <span className="text-xs text-gray-400">{attempts.length} Einträge</span>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12 text-gray-300 text-sm">Lade…</div>
        )}

        {!loading && attempts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-3xl">📞</span>
            <p className="text-sm text-gray-400">Noch keine Anrufe protokolliert.</p>
          </div>
        )}

        {!loading && groups.map(group => (
          <div key={group.key} className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{group.label}</p>
            <div className="bg-gray-50 rounded-xl px-3">
              {group.items.map(a => (
                <AttemptRow key={a.id} attempt={a} onContactClick={onContactClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}
