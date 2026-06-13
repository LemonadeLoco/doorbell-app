import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const CALL_MODE_KEY = 'doorbell_call_mode_pos'

const RESULT_META = {
  termin:           { label: 'Termin',           bg: '#D1FAE5', text: '#065F46', icon: '📅' },
  rueckruf:         { label: 'Rückruf',          bg: '#DBEAFE', text: '#1E40AF', icon: '🔁' },
  interesse:        { label: 'Interesse',         bg: '#FEF3C7', text: '#92400E', icon: '✅' },
  nicht_erreicht:   { label: 'Nicht erreicht',    bg: '#F3F4F6', text: '#374151', icon: '○'  },
  kein_interesse:   { label: 'Kein Interesse',    bg: '#FEE2E2', text: '#991B1B', icon: '✕'  },
  falsche_nummer:   { label: 'Falsche Nummer',    bg: '#FEE2E2', text: '#991B1B', icon: '📵' },
  kein_eigentuemer: { label: 'Kein Eigentümer',   bg: '#FEE2E2', text: '#991B1B', icon: '🚶' },
  reklamation:      { label: 'Reklamation',       bg: '#FEF3C7', text: '#92400E', icon: '⚠️' },
  direkt_verkauf:   { label: 'Direktverkauf',     bg: '#EDE9FE', text: '#5B21B6', icon: '🏆' },
}

const DISPOSITIONS = [
  { key: 'termin',           label: 'Termin vereinbart',       color: '#10B981', modal: 'termin'   },
  { key: 'rueckruf',         label: 'Rückruf vereinbart',      color: '#3B82F6', modal: 'rueckruf' },
  { key: 'interesse',        label: 'Interesse, kein Termin',  color: '#F59E0B' },
  { key: 'nicht_erreicht',   label: 'Nicht erreicht',          color: '#6B7280' },
  { key: 'kein_interesse',   label: 'Kein Interesse',          color: '#EF4444' },
  { key: 'falsche_nummer',   label: 'Falsche Nummer',          color: '#EF4444' },
  { key: 'kein_eigentuemer', label: 'Kein Eigentümer mehr',    color: '#EF4444' },
  { key: 'reklamation',      label: 'Reklamation',             color: '#F59E0B' },
]

const STATUS_LABELS = {
  nicht_erreichbar: 'Nicht erreichbar',
  kein_int:         'Kein Interesse',
  archiv:           'Archiviert',
  kontakt:          'Kontakt',
}

function fmt(dateStr, opts) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('de-DE', opts)
}
const fmtMonthYear = d => fmt(d, { month: 'long', year: 'numeric' })
const fmtDateTime  = d => fmt(d, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold text-gray-900 mb-4">{title}</p>
        {children}
      </div>
    </div>
  )
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────
function CollapsibleSection({ title, count, expanded, onToggle, accentColor = '#6B7280', children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        className="pressable flex items-center justify-between w-full px-4 py-3.5"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: accentColor }} />
          <span className="text-sm font-bold text-gray-700">{title}</span>
          <span
            className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white"
            style={{ background: accentColor }}
          >
            {count}
          </span>
        </div>
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Single card for active contact ──────────────────────────────────────────
function ActiveContactCard({ c, purchases, callHistory }) {
  return (
    <>
      {/* Identity */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-xl font-extrabold text-gray-900 leading-tight">{c.name}</h2>
            <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
              Hausbesitzer
            </span>
          </div>
          <div className="text-center bg-gray-50 rounded-xl px-3 py-2 flex-shrink-0">
            <p className="text-lg font-extrabold text-gray-700">{c.attempt_count ?? 0}</p>
            <p className="text-xs text-gray-400">Anrufe</p>
          </div>
        </div>

        {c.address && (
          <p className="text-sm text-gray-600 flex items-start gap-2 mb-2">
            <span className="text-gray-400 mt-0.5 flex-shrink-0">📍</span>
            <span>{c.address}</span>
          </p>
        )}

        {c.interest && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-400 text-sm">⭐</span>
            <span className="text-sm font-semibold text-gray-700">{c.interest}</span>
          </div>
        )}

        {c.last_result && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Letzter Anruf</p>
            <span
              className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: RESULT_META[c.last_result]?.bg ?? '#F3F4F6',
                color:      RESULT_META[c.last_result]?.text ?? '#374151',
              }}
            >
              {RESULT_META[c.last_result]?.icon} {RESULT_META[c.last_result]?.label ?? c.last_result}
            </span>
            {c.last_called_at && (
              <span className="text-xs text-gray-400 ml-2">{fmtDateTime(c.last_called_at)}</span>
            )}
          </div>
        )}
      </div>

      {/* Big call button */}
      {c.phone && (
        <a
          href={`tel:${c.phone.replace(/\s/g, '')}`}
          className="pressable flex items-center justify-center gap-3 py-5 rounded-2xl bg-green-500 text-white text-lg font-extrabold shadow-md"
        >
          📞 {c.phone}
        </a>
      )}

      {/* Kaufhistorie */}
      {purchases.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Kaufhistorie</p>
          <div className="flex flex-col divide-y divide-gray-50">
            {purchases.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                <span className="text-sm text-gray-700 font-medium flex-1 min-w-0 pr-3 truncate">
                  {p.product || p.product_raw || '—'}
                </span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {p.amount != null && (
                    <span className="text-sm font-bold text-gray-700">
                      {Number(p.amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{fmtMonthYear(p.purchased_at)}</span>
                </div>
              </div>
            ))}
          </div>
          {c.total_purchased != null && purchases.length > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between">
              <span className="text-sm text-gray-400 font-medium">Gesamt</span>
              <span className="text-sm font-extrabold text-gray-700">
                {Number(c.total_purchased).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Notizen */}
      {c.notes && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Notizen</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{c.notes}</p>
        </div>
      )}

      {/* Anrufverlauf */}
      {callHistory.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Anrufverlauf ({callHistory.length})
          </p>
          <div className="flex flex-col gap-3">
            {callHistory.map(h => {
              const meta = RESULT_META[h.result] ?? { icon: '○', bg: '#F3F4F6', text: '#374151', label: h.result }
              return (
                <div key={h.id} className="flex items-start gap-3">
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: meta.bg, color: meta.text }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-400">{fmtDateTime(h.called_at)}</span>
                    </div>
                    {h.note && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{h.note}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function CallModeScreen({ onBack }) {
  // Queue data
  const [queue, setQueue]                   = useState([])
  const [cooldownContacts, setCooldownContacts] = useState([])
  const [droppedContacts, setDroppedContacts]   = useState([])
  const [manualQueue, setManualQueue]           = useState([])

  // Progress
  const [initialTotal, setInitialTotal] = useState(0)
  const [index, setIndex]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [queueReady, setQueueReady]     = useState(false)

  // UI
  const [cooldownExpanded, setCooldownExpanded] = useState(false)
  const [droppedExpanded, setDroppedExpanded]   = useState(false)

  // Contact detail
  const [purchases, setPurchases]   = useState([])
  const [callHistory, setCallHistory] = useState([])

  // Disposition form
  const [note, setNote]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalDisp, setModalDisp] = useState(null)
  const [apptAt, setApptAt]       = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [interest, setInterest]   = useState('')

  // Active contact resolution: main queue takes priority over manual queue
  const mainContact  = queue[index] ?? null
  const isManualMode = !mainContact && manualQueue.length > 0
  const contact      = mainContact ?? manualQueue[0] ?? null

  const cooldownMonths = cooldownContacts[0]?.cooldown_months ?? 12

  // ── Load all data on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const [qRes, cRes, dRes] = await Promise.all([
        supabase.from('call_queue').select('*'),
        supabase.from('call_queue_on_cooldown').select('*'),
        supabase.from('call_queue_dropped').select('*'),
      ])
      const q = qRes.data ?? []
      setQueue(q)
      setInitialTotal(q.length)
      setCooldownContacts(cRes.data ?? [])
      setDroppedContacts(dRes.data ?? [])

      // Restore saved position
      const saved = JSON.parse(localStorage.getItem(CALL_MODE_KEY) ?? 'null')
      if (saved?.contactId && q.length > 0) {
        const idx = q.findIndex(c => c.id === saved.contactId)
        if (idx >= 0) setIndex(idx)
      }

      setQueueReady(true)
      setLoading(false)
    }
    run()
  }, [])

  // Reload just the two side-sections (after manual disposition)
  const reloadSections = useCallback(async () => {
    const [cRes, dRes] = await Promise.all([
      supabase.from('call_queue_on_cooldown').select('*'),
      supabase.from('call_queue_dropped').select('*'),
    ])
    setCooldownContacts(cRes.data ?? [])
    setDroppedContacts(dRes.data ?? [])
  }, [])

  // ── Load detail data when active contact changes ─────────────────────────────
  useEffect(() => {
    if (!queueReady) return
    if (!contact) {
      localStorage.removeItem(CALL_MODE_KEY)
      return
    }
    localStorage.setItem(CALL_MODE_KEY, JSON.stringify({ contactId: contact.id }))

    setPurchases([])
    setCallHistory([])
    setNote('')
    setApptAt('')
    setCallbackAt('')
    setInterest('')

    supabase
      .from('purchases')
      .select('id, product, product_raw, amount, purchased_at')
      .eq('contact_id', contact.id)
      .order('purchased_at', { ascending: false })
      .then(({ data }) => setPurchases(data ?? []))

    supabase
      .from('call_log')
      .select('id, result, called_at, note')
      .eq('contact_id', contact.id)
      .order('called_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setCallHistory(data ?? []))
  }, [contact?.id, queueReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disposition logic ────────────────────────────────────────────────────────
  const advance = useCallback(async () => {
    if (isManualMode) {
      setManualQueue(q => q.slice(1))
      await reloadSections()
    } else {
      setIndex(i => i + 1)
    }
  }, [isManualMode, reloadSections])

  const writeCallLog = async (result, noteText) => {
    await supabase.from('call_log').insert({
      contact_id: contact.id,
      result,
      note:       noteText?.trim() || null,
      called_at:  new Date().toISOString(),
    })
  }

  const updateContact = async (updates) => {
    await supabase.from('contacts').update(updates).eq('id', contact.id)
  }

  const handleDisp = async (key, contactUpdates = {}) => {
    setSubmitting(true)
    try {
      await writeCallLog(key, note)

      if (key === 'nicht_erreicht') {
        const projected = [{ result: 'nicht_erreicht' }, ...callHistory]
        let streak = 0
        for (const row of projected) {
          if (row.result === 'nicht_erreicht') streak++
          else break
        }
        if (streak >= 3) contactUpdates.status = 'nicht_erreichbar'
      }

      if (key === 'interesse')        contactUpdates.status = 'kontakt'
      if (key === 'kein_interesse')   contactUpdates.status = 'kein_int'
      if (key === 'falsche_nummer')   contactUpdates.status = 'archiv'
      if (key === 'kein_eigentuemer') contactUpdates.status = 'archiv'
      if (key === 'reklamation')      contactUpdates.status = 'kontakt'

      if (Object.keys(contactUpdates).length > 0) {
        await updateContact(contactUpdates)
      }
      await advance()
    } finally {
      setSubmitting(false)
    }
  }

  const handleTermin = async () => {
    if (!apptAt) return
    await handleDisp('termin', {
      status:  'termin',
      appt_at: new Date(apptAt).toISOString(),
      ...(interest.trim() ? { interest: interest.trim() } : {}),
    })
    setModalDisp(null)
  }

  const handleRueckruf = async () => {
    if (!callbackAt) return
    await handleDisp('rueckruf', {
      callback_at: new Date(callbackAt).toISOString(),
    })
    setModalDisp(null)
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading || !queueReady) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-30">
        <div className="w-10 h-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col z-30">

      {/* Header */}
      <div className="bg-white px-4 pt-5 pb-3 shadow-sm flex items-center gap-3 flex-shrink-0">
        <button className="pressable text-amber-500 font-bold text-xl px-1" onClick={onBack}>←</button>
        <div className="flex-1">
          <h1 className="text-base font-extrabold text-gray-900">
            {isManualMode ? 'Manuell — Kürzlich gekauft' : 'Anruf-Modus'}
          </h1>
        </div>
        {/* Progress — only for main queue */}
        {!isManualMode && initialTotal > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-sm font-extrabold text-gray-700">{index + 1} / {initialTotal}</span>
            <div className="mt-1 h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((index / Math.max(initialTotal, 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 flex flex-col gap-3">

          {/* Active contact card OR done banner */}
          {contact ? (
            <ActiveContactCard c={contact} purchases={purchases} callHistory={callHistory} />
          ) : (
            <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
              {initialTotal === 0 ? (
                <>
                  <p className="text-4xl mb-3">📭</p>
                  <p className="font-extrabold text-gray-900 mb-1">Queue leer</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Keine Bestandskunden in der aktiven Queue — entweder alle abgearbeitet oder Cooldown aktiv.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-4xl mb-3">🎉</p>
                  <p className="font-extrabold text-gray-900 mb-1">Alle {initialTotal} abgearbeitet!</p>
                  <p className="text-sm text-gray-500 mb-4">Queue für heute erledigt.</p>
                </>
              )}
              <button
                className="pressable px-5 py-2.5 bg-amber-400 text-white font-bold rounded-xl text-sm"
                onClick={onBack}
              >
                Zurück zur Pipeline
              </button>
            </div>
          )}

          {/* ── Kürzlich gekauft (Cooldown) ──────────────────────────────── */}
          {cooldownContacts.length > 0 && (
            <CollapsibleSection
              title={`Kürzlich gekauft (unter ${cooldownMonths} Monaten)`}
              count={cooldownContacts.length}
              expanded={cooldownExpanded}
              onToggle={() => setCooldownExpanded(v => !v)}
              accentColor="#8B5CF6"
            >
              <div className="flex flex-col divide-y divide-gray-50">
                {cooldownContacts.map(cc => (
                  <div key={cc.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{cc.name}</p>
                      {cc.address && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{cc.address}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {cc.last_purchased_at && (
                          <span className="text-xs text-purple-600 font-semibold">
                            Kauf: {fmtMonthYear(cc.last_purchased_at)}
                          </span>
                        )}
                        {cc.total_purchased != null && (
                          <span className="text-xs text-gray-400">
                            {Number(cc.total_purchased).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                      {cc.phone && (
                        <a
                          href={`tel:${cc.phone.replace(/\s/g, '')}`}
                          className="pressable px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-xl"
                          onClick={e => e.stopPropagation()}
                        >
                          📞 Anrufen
                        </a>
                      )}
                      <button
                        className="pressable px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-xl"
                        onClick={() => {
                          setManualQueue(q => {
                            if (q.find(x => x.id === cc.id)) return q
                            return [...q, cc]
                          })
                          setCooldownExpanded(false)
                        }}
                      >
                        In Queue aufnehmen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* ── Ergebnisse / Nicht anrufen ───────────────────────────────── */}
          {droppedContacts.length > 0 && (
            <CollapsibleSection
              title="Ergebnisse / Nicht anrufen"
              count={droppedContacts.length}
              expanded={droppedExpanded}
              onToggle={() => setDroppedExpanded(v => !v)}
              accentColor="#9CA3AF"
            >
              <div className="flex flex-col divide-y divide-gray-50">
                {droppedContacts.map(dc => {
                  const isReklamation = dc.last_result === 'reklamation'
                  const meta = RESULT_META[dc.last_result] ?? { icon: '○', bg: '#F3F4F6', text: '#374151', label: dc.last_result ?? STATUS_LABELS[dc.status] ?? dc.status }
                  const displayLabel = meta.label !== dc.last_result
                    ? meta.label
                    : (STATUS_LABELS[dc.status] ?? dc.status ?? '—')

                  return (
                    <div
                      key={dc.id}
                      className="px-4 py-3 flex items-center gap-3"
                      style={isReklamation ? { background: '#FFFBEB' } : {}}
                    >
                      {isReklamation && (
                        <span className="text-lg flex-shrink-0" title="Reklamation — Nachverfolgung prüfen">🔧</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-800">{dc.name}</p>
                          {isReklamation && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 font-bold">
                              Service
                            </span>
                          )}
                        </div>
                        {dc.address && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{dc.address}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: meta.bg, color: meta.text }}
                          >
                            {meta.icon} {displayLabel}
                          </span>
                          {dc.last_called_at && (
                            <span className="text-xs text-gray-400">{fmtDateTime(dc.last_called_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          )}

          {/* Bottom spacing when fixed panel is visible */}
          {contact && <div className="h-64" />}
        </div>
      </div>

      {/* Fixed disposition panel — only when there's an active contact */}
      {contact && (
        <div
          className="flex-shrink-0 bg-white border-t border-gray-100 px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
        >
          <textarea
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none mb-3"
            rows={2}
            placeholder="Schnellnotiz zum Anruf (optional)..."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            {DISPOSITIONS.map(d => (
              <button
                key={d.key}
                disabled={submitting}
                className="pressable py-3 px-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                style={{ background: d.color }}
                onClick={() => {
                  if (d.modal) setModalDisp(d.modal)
                  else handleDisp(d.key)
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Termin modal */}
      {modalDisp === 'termin' && (
        <Modal title="📅 Termin vereinbaren" onClose={() => setModalDisp(null)}>
          <label className="block mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum &amp; Uhrzeit *</span>
            <input
              type="datetime-local"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={apptAt}
              onChange={e => setApptAt(e.target.value)}
            />
          </label>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Interesse / Produkt</span>
            <input
              type="text"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              placeholder="z. B. Rollläden, Haustür …"
              value={interest}
              onChange={e => setInterest(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button className="pressable flex-1 py-3 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100"
              onClick={() => setModalDisp(null)}>Abbrechen</button>
            <button
              className="pressable flex-1 py-3 rounded-xl text-sm font-bold text-white bg-green-500 disabled:opacity-40"
              disabled={!apptAt || submitting}
              onClick={handleTermin}
            >Speichern</button>
          </div>
        </Modal>
      )}

      {/* Rückruf modal */}
      {modalDisp === 'rueckruf' && (
        <Modal title="🔁 Rückruf eintragen" onClose={() => setModalDisp(null)}>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wann zurückrufen? *</span>
            <input
              type="datetime-local"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={callbackAt}
              onChange={e => setCallbackAt(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button className="pressable flex-1 py-3 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100"
              onClick={() => setModalDisp(null)}>Abbrechen</button>
            <button
              className="pressable flex-1 py-3 rounded-xl text-sm font-bold text-white bg-blue-500 disabled:opacity-40"
              disabled={!callbackAt || submitting}
              onClick={handleRueckruf}
            >Speichern</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
