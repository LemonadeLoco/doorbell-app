import { useState } from 'react'
import { StatusBadge, SourceBadge } from '../components/StatusBadge'
import { STATUSES } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { Toast, useToast } from '../components/Toast'
import { useCallAttempts } from '../hooks/useCallAttempts'

const OUTCOME_ICONS = { erreicht: '✓', nicht_erreicht: '○', mailbox: '📬' }
const OUTCOME_LABELS = { erreicht: 'Erreicht', nicht_erreicht: 'Nicht erreicht', mailbox: 'Mailbox' }

export function ContactDetailScreen({ contact: initial, onBack }) {
  const [contact, setContact]     = useState(initial)
  const [notes, setNotes]         = useState(initial.notes ?? '')
  const [saleAmount, setSaleAmount] = useState(initial.sale_amount ?? '')
  const [callPhase, setCallPhase] = useState(null) // null | 'reached' | logged
  const { toast, show }           = useToast()
  const { attempts, log, failCount } = useCallAttempts(contact.id)

  const update = async (patch) => {
    const { data } = await supabase.from('contacts').update(patch).eq('id', contact.id).select().single()
    if (data) setContact(data)
    return data
  }

  const handleStatusChange = async (s) => { await update({ status: s }); show('Status aktualisiert') }
  const handleNoteBlur     = async ()  => { await update({ notes }); show('Notiz gespeichert') }
  const handleSaleAmount   = async ()  => {
    const amt = parseFloat(String(saleAmount).replace(/\./g,'').replace(',','.'))
    if (isNaN(amt)) return
    await update({ sale_amount: amt })
    show('Betrag gespeichert')
  }

  const handleCallOutcome = async (outcome) => {
    if (outcome === 'erreicht') { setCallPhase('reached'); return }
    const newCount = await log(outcome)
    setCallPhase(null)
    show(outcome === 'mailbox' ? 'Mailbox notiert' : 'Nicht erreicht notiert')
    if (newCount >= 3) {
      const archive = window.confirm('3 erfolglose Versuche. Kontakt archivieren?')
      if (archive) { await update({ status: 'archiv' }); show('Archiviert') }
    }
  }

  const tel = contact.phone?.replace(/\s/g, '')
  const isAnruf = contact.source === 'anruf'

  const fmt = (n) => n ? '€' + parseFloat(n).toLocaleString('de-DE') : null

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-5 pb-4 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-amber-500 font-semibold text-sm mb-3">
          ← Pipeline
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">{contact.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <SourceBadge source={contact.source} />
              <StatusBadge status={contact.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">
        {/* Anruf protokollieren — only for Bestandskunden */}
        {isAnruf && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Anruf protokollieren</p>
            {callPhase === 'reached' ? (
              <div>
                <p className="text-xs text-gray-500 mb-2">Ergebnis des Gesprächs:</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(STATUSES).filter(([k]) => ['kontakt','termin','kein_int'].includes(k)).map(([key, s]) => (
                    <button
                      key={key}
                      className="btn-press py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: s.bg, color: s.text }}
                      onClick={async () => {
                        await log('erreicht')
                        await handleStatusChange(key)
                        setCallPhase(null)
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button className="mt-2 text-xs text-gray-400 w-full text-center py-1" onClick={() => setCallPhase(null)}>Abbrechen</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'erreicht',       label: '✓ Erreicht',       bg: '#D1FAE5', text: '#065F46' },
                  { id: 'nicht_erreicht', label: '✗ Nicht erreicht', bg: '#FEE2E2', text: '#991B1B' },
                  { id: 'mailbox',        label: '📬 Mailbox',        bg: '#F3F4F6', text: '#374151' },
                ].map(o => (
                  <button
                    key={o.id}
                    className="btn-press py-3 rounded-xl text-xs font-bold"
                    style={{ background: o.bg, color: o.text }}
                    onClick={() => handleCallOutcome(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Call attempt history */}
        {isAnruf && attempts.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Anrufhistorie</p>
            <div className="flex flex-col gap-2">
              {attempts.map((a, i) => (
                <div key={a.id ?? i} className="flex items-center gap-3 text-sm">
                  <span style={{ color: a.outcome === 'erreicht' ? '#065F46' : '#9CA3AF' }}>
                    {OUTCOME_ICONS[a.outcome]}
                  </span>
                  <span className="flex-1 text-gray-600">{OUTCOME_LABELS[a.outcome]}</span>
                  <span className="text-xs text-gray-300">
                    {new Date(a.attempted_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
            {failCount >= 2 && (
              <p className="text-xs text-red-400 mt-3">{failCount} erfolglose Versuche</p>
            )}
          </div>
        )}

        {/* Call button */}
        {tel && (
          <a
            href={`tel:${tel}`}
            className="btn-press flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-base shadow-sm"
          >
            📞 Anrufen — {contact.phone}
          </a>
        )}

        {/* Info card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          {[
            { label: 'Adresse',      value: contact.address },
            { label: 'Produkt',      value: contact.product },
            { label: 'Termin',       value: contact.appt_at ? new Date(contact.appt_at).toLocaleString('de-DE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null },
            { label: 'Quelle',       value: contact.source === 'tür' ? 'Haustür-Kontakt' : contact.source === 'anruf' ? 'Bestandskunde' : null },
            { label: 'Hinzugefügt',  value: new Date(contact.added_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) },
          ].filter(r => r.value).map(r => (
            <div key={r.label} className="flex justify-between text-sm gap-4">
              <span className="text-gray-400 font-medium flex-shrink-0">{r.label}</span>
              <span className="text-gray-800 font-semibold text-right">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notizen</p>
          <textarea
            className="w-full text-sm text-gray-700 focus:outline-none resize-none bg-transparent"
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Notiz hinzufügen..."
          />
        </div>

        {/* Status grid */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Status ändern</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(STATUSES).map(([key, s]) => (
              <button
                key={key}
                onClick={() => handleStatusChange(key)}
                className="btn-press py-2.5 rounded-xl text-xs font-bold transition-all"
                style={contact.status === key ? { background: s.text, color: '#fff' } : { background: s.bg, color: s.text }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sale amount */}
        {contact.status === 'verkauft' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Abschluss-Betrag</p>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-semibold">€</span>
              <input
                type="number"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
                value={saleAmount}
                onChange={e => setSaleAmount(e.target.value)}
                placeholder="0"
              />
              <button className="btn-press px-4 py-3 bg-purple-100 text-purple-700 font-bold text-sm rounded-xl" onClick={handleSaleAmount}>
                Speichern
              </button>
            </div>
            {contact.sale_amount && (
              <p className="text-xs text-gray-400 mt-2">Gespeichert: {fmt(contact.sale_amount)}</p>
            )}
          </div>
        )}
      </div>

      <Toast toast={toast} />
    </div>
  )
}
