import { useState } from 'react'
import { StatusBadge, SourceBadge } from '../components/StatusBadge'
import { STATUSES } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { Toast, useToast } from '../components/Toast'
import { useCallAttempts } from '../hooks/useCallAttempts'

const OUTCOME_ICONS  = { erreicht: '✓', nicht_erreicht: '○', mailbox: '📬' }
const OUTCOME_LABELS = { erreicht: 'Erreicht', nicht_erreicht: 'Nicht erreicht', mailbox: 'Mailbox' }

export function ContactDetailScreen({ contact: initial, onBack }) {
  const [contact, setContact]   = useState(initial)
  const [notes, setNotes]       = useState(initial.notes ?? '')
  const [saleAmount, setSaleAmount] = useState(initial.sale_amount ?? '')
  const [callPhase, setCallPhase] = useState(null)
  const { toast, show }         = useToast()
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
    await update({ sale_amount: amt }); show('Betrag gespeichert')
  }

  const handleCallOutcome = async (outcome) => {
    if (outcome === 'erreicht') { setCallPhase('reached'); return }
    const newCount = await log(outcome)
    setCallPhase(null)
    show(outcome === 'mailbox' ? 'Mailbox notiert' : 'Nicht erreicht notiert')
    if (newCount >= 3) {
      if (window.confirm('3 erfolglose Versuche. Kontakt archivieren?')) {
        await update({ status: 'archiv' }); show('Archiviert')
      }
    }
  }

  const handleApptOutcome = async (outcome) => {
    const notes = outcome === 'abgesagt' ? `Termin abgesagt am ${new Date().toLocaleDateString('de-DE')}` : null
    const patch = { appt_outcome: outcome }
    if (outcome === 'stattgefunden') patch.status = 'kontakt'
    if (outcome === 'abgesagt')      { patch.status = 'kontakt'; if (notes) patch.notes = notes }
    await update(patch)
    show(outcome === 'stattgefunden' ? 'Termin bestätigt' : outcome === 'niemand_da' ? 'Notiert' : 'Abgesagt')
  }

  const handleDoNotReturn = async () => {
    const current = contact.do_not_return
    await update({ do_not_return: !current })
    show(current ? 'Markierung entfernt' : '⛔ Als "Nicht klingeln" markiert')
  }

  const tel      = contact.phone?.replace(/\s/g, '')
  const isAnruf  = contact.source === 'anruf'
  const isTermin = contact.status === 'termin'
  const fmt = (n) => n ? '€' + parseFloat(n).toLocaleString('de-DE') : null

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
        {/* Termin actions — only when status = termin */}
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
            {contact.appt_at && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                Termin: {new Date(contact.appt_at).toLocaleString('de-DE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        {/* Anruf protokollieren */}
        {isAnruf && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Anruf protokollieren</p>
            {callPhase === 'reached' ? (
              <div>
                <p className="text-xs text-gray-500 mb-2">Ergebnis des Gesprächs:</p>
                <div className="grid grid-cols-3 gap-2">
                  {[['kontakt','Kontakt'],['termin','Termin'],['kein_int','Kein Int.']].map(([key, lbl]) => (
                    <button key={key} className="pressable py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: STATUSES[key]?.bg, color: STATUSES[key]?.text }}
                      onClick={async () => { await log('erreicht'); await handleStatusChange(key); setCallPhase(null) }}>
                      {lbl}
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
                  <button key={o.id} className="pressable py-3 rounded-xl text-xs font-bold"
                    style={{ background: o.bg, color: o.text }}
                    onClick={() => handleCallOutcome(o.id)}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Call history */}
        {isAnruf && attempts.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Anrufhistorie</p>
            <div className="flex flex-col gap-2">
              {attempts.map((a, i) => (
                <div key={a.id ?? i} className="flex items-center gap-3 text-sm">
                  <span style={{ color: a.outcome === 'erreicht' ? '#065F46' : '#9CA3AF' }}>{OUTCOME_ICONS[a.outcome]}</span>
                  <span className="flex-1 text-gray-600">{OUTCOME_LABELS[a.outcome]}</span>
                  <span className="text-xs text-gray-300">
                    {new Date(a.attempted_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
            {failCount >= 2 && <p className="text-xs text-red-400 mt-3">{failCount} erfolglose Versuche</p>}
          </div>
        )}

        {/* Call button */}
        {tel && (
          <a href={`tel:${tel}`} className="pressable flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-base shadow-sm">
            📞 Anrufen — {contact.phone}
          </a>
        )}

        {/* Info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          {[
            { label: 'Adresse',    value: [contact.address, contact.apartment].filter(Boolean).join(' · ') || null },
            { label: 'Produkt',    value: contact.product },
            { label: 'Termin',     value: contact.appt_at ? new Date(contact.appt_at).toLocaleString('de-DE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null },
            { label: 'Quelle',     value: contact.source === 'tür' ? 'Haustür-Kontakt' : contact.source === 'anruf' ? 'Bestandskunde' : null },
            { label: 'Hinzugefügt',value: new Date(contact.added_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) },
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
          <textarea className="w-full text-sm text-gray-700 focus:outline-none resize-none bg-transparent" rows={4}
            value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleNoteBlur} placeholder="Notiz hinzufügen..." />
        </div>

        {/* Status */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Status ändern</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(STATUSES).map(([key, s]) => (
              <button key={key} onClick={() => handleStatusChange(key)}
                className="pressable py-2.5 rounded-xl text-xs font-bold transition-all"
                style={contact.status === key ? { background: s.text, color: '#fff' } : { background: s.bg, color: s.text }}>
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
              <input type="number" className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
                value={saleAmount} onChange={e => setSaleAmount(e.target.value)} placeholder="0" />
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

      <Toast toast={toast} />
    </div>
  )
}
