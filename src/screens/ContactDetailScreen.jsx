import { useState, useRef } from 'react'
import { StatusBadge, SourceBadge } from '../components/StatusBadge'
import { STATUSES, PRODUCTS } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { Toast, useToast } from '../components/Toast'
import { useCallAttempts } from '../hooks/useCallAttempts'
import { CallOutcomeOverlay, RESULT_LABELS } from '../components/CallOutcomeOverlay'

const OUTCOME_ICONS  = { erreicht: '✓', nicht_erreicht: '○', mailbox: '📬' }
const OUTCOME_LABELS = { erreicht: 'Erreicht', nicht_erreicht: 'Nicht erreicht', mailbox: 'Mailbox' }

const UPSELL_MAP = {
  'Markise':               ['Terrassendach', 'Zip-Screen'],
  'Haustür':               ['Fenster', 'Rollläden', 'Vordach'],
  'Kunststofffenster':     ['Rollläden', 'Haustür'],
  'Fenster':               ['Rollläden', 'Haustür'],
  'Rollläden':             ['Markise', 'Terrassendach'],
}

// Contextual mini modal — floating card centered
function StatusModal({ title, children, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold text-gray-900 mb-4">{title}</p>
        {children}
      </div>
    </div>
  )
}

// Inline editable row
function EditRow({ label, value, onSave, type = 'text', options = null }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? '')

  const commit = async () => {
    setEditing(false)
    if (draft !== (value ?? '')) await onSave(draft)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-gray-400 font-medium text-xs uppercase tracking-wide">{label}</span>
        {options ? (
          <select
            className="border border-amber-400 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            autoFocus
          >
            <option value="">— wählen —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            type={type}
            className="border border-amber-400 rounded-xl px-3 py-2 text-sm focus:outline-none"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            autoFocus
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex justify-between text-sm gap-4 items-center">
      <span className="text-gray-400 font-medium flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-gray-800 font-semibold text-right truncate">{value || <span className="text-gray-300 italic">—</span>}</span>
        <button
          className="pressable flex-shrink-0 text-gray-300 hover:text-amber-400 text-sm"
          onClick={() => { setDraft(value ?? ''); setEditing(true) }}
        >✎</button>
      </div>
    </div>
  )
}

export function ContactDetailScreen({ contact: initial, onBack }) {
  const [contact, setContact]   = useState(initial)
  const [notes, setNotes]       = useState(initial.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [saleAmount, setSaleAmount] = useState(initial.sale_amount ?? '')
  const [pendingStatus, setPendingStatus] = useState(null)
  const [modalDate, setModalDate]   = useState('')
  const [modalAmount, setModalAmount] = useState('')
  const [undoSnack, setUndoSnack]   = useState(null)
  const [showCallOverlay, setShowCallOverlay] = useState(false)
  const undoSnackTimer = useRef(null)
  const { toast, show }         = useToast()
  const { attempts, failCount, reload: reloadAttempts } = useCallAttempts(contact.id)

  const update = async (patch) => {
    const { data } = await supabase.from('contacts').update(patch).eq('id', contact.id).select().single()
    if (data) setContact(data)
    return data
  }

  const applyStatus = async (s, extra = {}) => {
    const prev = contact.status
    await update({ status: s, ...extra })
    clearTimeout(undoSnackTimer.current)
    setUndoSnack({ label: STATUSES[s]?.label ?? s, prevStatus: prev })
    undoSnackTimer.current = setTimeout(() => setUndoSnack(null), 4000)
  }

  const handleStatusTap = (key) => {
    if (key === 'termin') {
      setModalDate(contact.appt_at ? new Date(contact.appt_at).toISOString().slice(0,16) : '')
      setPendingStatus('termin')
    } else if (key === 'verkauft') {
      setModalAmount(contact.sale_amount ?? '')
      setPendingStatus('verkauft')
    } else if (key === 'wiedervorlage') {
      setModalDate(contact.followup_at ? new Date(contact.followup_at).toISOString().slice(0,10) : '')
      setPendingStatus('wiedervorlage')
    } else if (key === 'kein_int' || key === 'archiv') {
      applyStatus(key)
    } else {
      applyStatus(key)
    }
  }

  const confirmModal = async () => {
    if (pendingStatus === 'termin') {
      if (!modalDate) return
      await applyStatus('termin', { appt_at: new Date(modalDate).toISOString() })
    } else if (pendingStatus === 'verkauft') {
      const amt = parseFloat(String(modalAmount).replace(/\./g,'').replace(',','.'))
      await applyStatus('verkauft', isNaN(amt) ? {} : { sale_amount: amt })
    } else if (pendingStatus === 'wiedervorlage') {
      await applyStatus('wiedervorlage', modalDate ? { followup_at: new Date(modalDate).toISOString() } : {})
    }
    setPendingStatus(null)
  }

  const handleNoteBlur = async () => {
    await update({ notes })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 1500)
  }

  const handleSaleAmount = async () => {
    const amt = parseFloat(String(saleAmount).replace(/\./g,'').replace(',','.'))
    if (isNaN(amt)) return
    await update({ sale_amount: amt }); show('Betrag gespeichert')
  }

  const handleApptOutcome = async (outcome) => {
    const note = outcome === 'abgesagt' ? `Termin abgesagt am ${new Date().toLocaleDateString('de-DE')}` : null
    const patch = { appt_outcome: outcome }
    if (outcome === 'stattgefunden') patch.status = 'kontakt'
    if (outcome === 'abgesagt')      { patch.status = 'kontakt'; if (note) patch.notes = note }
    await update(patch)
    show(outcome === 'stattgefunden' ? 'Termin bestätigt' : outcome === 'niemand_da' ? 'Notiert' : 'Abgesagt')
  }

  const handleDoNotReturn = async () => {
    const current = contact.do_not_return
    await update({ do_not_return: !current })
    show(current ? 'Markierung entfernt' : '⛔ Als "Nicht klingeln" markiert')
  }

  const undoStatus = async () => {
    if (!undoSnack) return
    clearTimeout(undoSnackTimer.current)
    await update({ status: undoSnack.prevStatus })
    setUndoSnack(null)
    show('Rückgängig gemacht ✓')
  }

  const handleOverlayClose = async () => {
    setShowCallOverlay(false)
    const { data } = await supabase.from('contacts').select('*').eq('id', contact.id).single()
    if (data) { setContact(data); setNotes(data.notes ?? '') }
    reloadAttempts()
  }

  const tel      = contact.phone?.replace(/\s/g, '')
  const isAnruf  = contact.source === 'anruf'
  const isTermin = contact.status === 'termin'
  const fmt = (n) => n ? '€' + parseFloat(n).toLocaleString('de-DE') : null

  const isApptToday = contact.appt_at && new Date(contact.appt_at).toDateString() === new Date().toDateString()
  const upsells = UPSELL_MAP[contact.original_produkt ?? contact.product] ?? []

  const fmtAppt = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  }

  const isPreCallNote = !notes && isAnruf

  const NEXT_STEP_STATUSES = ['anrufen', 'kontakt', 'termin', 'verkauft', 'wiedervorlage']
  const CLOSE_STATUSES     = ['kein_int', 'archiv']

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 screen-slide-in">
      <div className="bg-white px-4 pt-5 pb-4 shadow-sm">
        <button onClick={onBack} className="pressable flex items-center gap-2 text-amber-500 font-semibold text-sm mb-3">
          ← Pipeline
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">{contact.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <SourceBadge source={contact.source} />
              <StatusBadge status={contact.status} />
              {contact.do_not_return && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">⛔ Nicht klingeln</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">

        {/* Appointment card — shown when status=termin */}
        {isTermin && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {contact.appt_at ? (
              <div className="flex items-center gap-3 px-4 py-3" style={{ background: isApptToday ? '#FEF3C7' : '#D1FAE5' }}>
                <span className="text-lg">📅</span>
                <span className="flex-1 text-sm font-bold" style={{ color: isApptToday ? '#92400E' : '#065F46' }}>
                  Termin · {fmtAppt(contact.appt_at)} Uhr
                </span>
                <button
                  className="pressable text-gray-400 text-sm"
                  onClick={() => { setModalDate(new Date(contact.appt_at).toISOString().slice(0,16)); setPendingStatus('termin') }}
                >✎</button>
              </div>
            ) : (
              <button
                className="pressable flex items-center gap-3 px-4 py-3 w-full bg-red-50"
                onClick={() => { setModalDate(''); setPendingStatus('termin') }}
              >
                <span className="text-lg">⚠️</span>
                <span className="flex-1 text-sm font-semibold text-red-600 text-left">Kein Termin-Datum gesetzt — tippe um zu setzen</span>
              </button>
            )}
          </div>
        )}

        {/* Termin actions — only when status = termin and not yet resolved */}
        {isTermin && !contact.appt_outcome && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Termin-Aktionen</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'stattgefunden', label: '✓ Stattgefunden', bg: '#D1FAE5', text: '#065F46' },
                { id: 'niemand_da',    label: '✗ Niemand da',    bg: '#FEE2E2', text: '#991B1B' },
                { id: 'abgesagt',      label: '✗ Abgesagt',      bg: '#F3F4F6', text: '#374151' },
              ].map(o => (
                <button key={o.id} onClick={() => handleApptOutcome(o.id)}
                  className="pressable py-3 rounded-xl text-xs font-bold"
                  style={{ background: o.bg, color: o.text }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Anruf-Verlauf — shown for all contacts that have call attempts */}
        {attempts.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Anruf-Verlauf</p>
            <div className="flex flex-col">
              {attempts.map((a, i) => (
                <div key={a.id ?? i} className="flex flex-col gap-0.5 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 text-sm">
                    <span style={{ color: a.outcome === 'erreicht' ? '#065F46' : '#9CA3AF' }}>{OUTCOME_ICONS[a.outcome]}</span>
                    <span className="flex-1 text-gray-600">
                      {OUTCOME_LABELS[a.outcome]}{a.result ? ` · ${RESULT_LABELS[a.result] ?? a.result}` : ''}
                    </span>
                    <span className="text-xs text-gray-300">
                      {new Date(a.attempted_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {a.notes && <p className="text-xs text-gray-400 ml-6">{a.notes}</p>}
                </div>
              ))}
            </div>
            {failCount >= 2 && <p className="text-xs text-red-400 mt-3">{failCount} erfolglose Versuche</p>}
          </div>
        )}

        {/* Call button + Anruf eintragen */}
        {tel && (
          <div className="flex flex-col gap-2">
            <a href={`tel:${tel}`} className="pressable flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-base shadow-sm">
              📞 Anrufen — {contact.phone}
            </a>
            <button
              onClick={() => setShowCallOverlay(true)}
              className="pressable flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-white text-gray-600 font-semibold text-sm shadow-sm border border-gray-200"
            >
              📋 Anruf eintragen
            </button>
          </div>
        )}

        {/* Upsell tip for Bestandskunden */}
        {isAnruf && upsells.length > 0 && (
          <div className="bg-amber-50 rounded-2xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-700">
              💡 Upsell-Tipp: Hatte {contact.original_produkt ?? contact.product} → frag nach {upsells.join(' / ')}
            </p>
          </div>
        )}

        {/* Kaufhistorie for Bestandskunden */}
        {isAnruf && (contact.kaufdatum || contact.kaufbetrag || contact.auftragsnummer) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kaufhistorie</p>
            <div className="flex flex-col gap-2">
              {contact.original_produkt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Produkt</span>
                  <span className="text-gray-800 font-semibold">{contact.original_produkt}</span>
                </div>
              )}
              {contact.kaufdatum && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Kaufdatum</span>
                  <span className="text-gray-800 font-semibold">{new Date(contact.kaufdatum).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
                </div>
              )}
              {contact.kaufbetrag && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Kaufbetrag</span>
                  <span className="text-gray-800 font-semibold">{fmt(contact.kaufbetrag)}</span>
                </div>
              )}
              {contact.auftragsnummer && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Auftragsnr.</span>
                  <span className="text-gray-800 font-semibold">{contact.auftragsnummer}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info — editable rows */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <EditRow
            label="Adresse"
            value={[contact.address, contact.apartment].filter(Boolean).join(' · ') || null}
            onSave={async v => { await update({ address: v }); show('Adresse gespeichert') }}
          />
          <EditRow
            label="Telefon"
            value={contact.phone}
            type="tel"
            onSave={async v => { await update({ phone: v }); show('Telefon gespeichert') }}
          />
          <EditRow
            label="Produkt"
            value={contact.product}
            options={PRODUCTS}
            onSave={async v => { await update({ product: v }); show('Produkt gespeichert') }}
          />
          <div className="flex justify-between text-sm gap-4">
            <span className="text-gray-400 font-medium flex-shrink-0">Quelle</span>
            <span className="text-gray-800 font-semibold text-right">
              {contact.source === 'tür' ? 'Haustür-Kontakt' : contact.source === 'anruf' ? 'Bestandskunde' : null}
            </span>
          </div>
          <div className="flex justify-between text-sm gap-4">
            <span className="text-gray-400 font-medium flex-shrink-0">Hinzugefügt</span>
            <span className="text-gray-800 font-semibold text-right">
              {new Date(contact.added_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div
          className="bg-white rounded-2xl p-4 shadow-sm"
          style={{ border: notesSaved ? '1.5px solid #10B981' : '1.5px solid transparent', transition: 'border-color 0.4s' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notizen</p>
            <span className="text-gray-300 text-sm">✎</span>
          </div>
          {isPreCallNote && (
            <p className="text-xs text-gray-400 mb-2 leading-relaxed">
              ANRUF-VORBEREITUNG (tippe um zu bearbeiten)<br />
              · Zufrieden mit {contact.original_produkt ?? contact.product ?? 'Produkt'}?<br />
              · Neuer Bedarf / Erweiterung?<br />
              · Partner verfügbar für Termin?
            </p>
          )}
          <textarea
            className="w-full text-sm text-gray-700 focus:outline-none resize-none bg-transparent"
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, 500))}
            onBlur={handleNoteBlur}
            placeholder="Notiz hinzufügen..."
          />
          {notes.length >= 400 && (
            <p className="text-xs text-gray-400 text-right mt-1">{notes.length}/500</p>
          )}
          {notesSaved && <p className="text-xs text-green-500 mt-1">Gespeichert ✓</p>}
        </div>

        {/* Status grid */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Nächster Schritt</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {NEXT_STEP_STATUSES.map(key => {
              const s = STATUSES[key]
              const active = contact.status === key
              return (
                <button key={key} onClick={() => handleStatusTap(key)}
                  className="pressable py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
                  style={active ? { background: s.text, color: '#fff' } : { background: s.bg, color: s.text }}>
                  {active && <span>✓</span>}{s.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Abschliessen</p>
          <div className="grid grid-cols-2 gap-2">
            {CLOSE_STATUSES.map(key => {
              const s = STATUSES[key]
              const active = contact.status === key
              return (
                <button key={key} onClick={() => handleStatusTap(key)}
                  className="pressable py-2 rounded-xl text-xs font-semibold transition-all"
                  style={active ? { background: s.text, color: '#fff' } : { background: s.bg, color: s.text }}>
                  {active && '✓ '}{s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sale amount — shown when status=verkauft */}
        {contact.status === 'verkauft' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Abschluss-Betrag</p>
            {!contact.sale_amount && (
              <p className="text-xs text-amber-600 mb-2">⚠️ Betrag fehlt — bitte eintragen</p>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-semibold">€</span>
              <input
                type="number"
                inputMode="decimal"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
                value={saleAmount}
                onChange={e => setSaleAmount(e.target.value)}
                placeholder="0"
              />
              <button className="pressable px-4 py-3 bg-purple-100 text-purple-700 font-bold text-sm rounded-xl" onClick={handleSaleAmount}>Speichern</button>
            </div>
            {contact.sale_amount && <p className="text-xs text-gray-400 mt-2">Gespeichert: {fmt(contact.sale_amount)}</p>}
          </div>
        )}

        {/* Do not return */}
        <button
          onClick={handleDoNotReturn}
          className="pressable w-full py-3 rounded-xl text-sm font-semibold mt-1"
          style={contact.do_not_return
            ? { background: '#FEE2E2', color: '#991B1B' }
            : { background: '#F9FAFB', color: '#9CA3AF', border: '1px solid #E5E7EB' }
          }
        >
          {contact.do_not_return ? '⛔ Markierung entfernen' : '⛔ Nicht nochmal klingeln'}
        </button>
      </div>

      {/* Status undo snackbar */}
      {undoSnack && (
        <div
          className="fixed bottom-6 left-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg"
          style={{ transform: 'translateX(-50%)' }}
        >
          <span>Status: {undoSnack.label} gesetzt</span>
          <button className="pressable text-amber-400 font-bold" onClick={undoStatus}>Rückgängig</button>
        </div>
      )}

      {/* Contextual status modals */}
      {pendingStatus === 'termin' && (
        <StatusModal title="Termin-Datum festlegen" onCancel={() => setPendingStatus(null)}>
          <input
            type="datetime-local"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400 mb-4"
            value={modalDate}
            onChange={e => setModalDate(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="pressable flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600" onClick={() => setPendingStatus(null)}>Abbrechen</button>
            <button className="pressable flex-1 py-3 rounded-xl text-sm font-bold bg-green-500 text-white" onClick={confirmModal}>Termin setzen</button>
          </div>
        </StatusModal>
      )}

      {pendingStatus === 'verkauft' && (
        <StatusModal title="Verkaufsbetrag" onCancel={() => setPendingStatus(null)}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gray-500 font-semibold">€</span>
            <input
              type="number"
              inputMode="decimal"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={modalAmount}
              onChange={e => setModalAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button className="pressable flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600" onClick={() => { setModalAmount(''); confirmModal() }}>Überspringen</button>
            <button className="pressable flex-1 py-3 rounded-xl text-sm font-bold bg-purple-500 text-white" onClick={confirmModal}>Verkauft</button>
          </div>
        </StatusModal>
      )}

      {pendingStatus === 'wiedervorlage' && (
        <StatusModal title="Wiedervorlage am" onCancel={() => setPendingStatus(null)}>
          <input
            type="date"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400 mb-4"
            value={modalDate}
            onChange={e => setModalDate(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="pressable flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600" onClick={confirmModal}>Überspringen</button>
            <button className="pressable flex-1 py-3 rounded-xl text-sm font-bold bg-blue-500 text-white" onClick={confirmModal}>Speichern</button>
          </div>
        </StatusModal>
      )}

      {/* Call Outcome Overlay */}
      {showCallOverlay && (
        <CallOutcomeOverlay
          contact={contact}
          onClose={handleOverlayClose}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
