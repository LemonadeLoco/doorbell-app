import { useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { supabase } from '../lib/supabase'

const RESULT_LABELS = {
  termin:         'Termin',
  kein_int:       'Kein Int.',
  spaeter:        'Wiedervorlage',
  falsche_nummer: 'Falsche Nummer',
}

export { RESULT_LABELS }

export function CallOutcomeOverlay({ contact, onClose, externalNote = null }) {
  const [step, setStep]             = useState('reach')
  const [reachability, setReachability] = useState(null)
  const [result, setResult]         = useState(null)
  const [note, setNote]             = useState(externalNote ?? '')
  const [date, setDate]             = useState('')
  const [saving, setSaving]         = useState(false)

  const canConfirmResult = result !== null &&
    ((result !== 'termin' && result !== 'spaeter') || date !== '')

  const writeAttempt = async (outcome, resultKey, patch) => {
    setSaving(true)
    const { data: authData } = await supabase.auth.getSession()
    const userId = authData.session?.user?.id ?? null
    await supabase.from('call_attempts').insert({
      contact_id:   contact.id,
      outcome,
      result:       resultKey,
      notes:        note || null,
      attempted_at: new Date().toISOString(),
      user_id:      userId,
    })
    if (patch && Object.keys(patch).length > 0) {
      await supabase.from('contacts').update(patch).eq('id', contact.id)
    }
    setSaving(false)
    onClose()
  }

  const handleSelectReachability = (val) => {
    setReachability(val)
    if (val === 'erreicht') setStep('result')
  }

  const handleConfirmReach = async () => {
    if (!reachability || reachability === 'erreicht') return
    await writeAttempt(reachability, null, null)
  }

  const handleConfirmResult = async () => {
    if (!result) return
    let patch = {}
    if (result === 'termin') {
      if (!date) return
      patch = { status: 'termin', appt_at: new Date(date).toISOString() }
    } else if (result === 'kein_int') {
      patch = { status: 'kein_int' }
    } else if (result === 'spaeter') {
      if (!date) return
      patch = { status: 'wiedervorlage', followup_at: new Date(date).toISOString() }
    } else if (result === 'falsche_nummer') {
      const existing = contact.notes ?? ''
      patch = { notes: existing ? `${existing} | Falsche Nummer` : 'Falsche Nummer' }
    }
    await writeAttempt('erreicht', result, patch)
  }

  if (!contact.phone) {
    return (
      <BottomSheet onClose={onClose} className="px-5 pb-8">
        <p className="text-sm font-bold text-gray-900 mb-2">Kein Anruf möglich</p>
        <p className="text-sm text-gray-500 mb-4">Keine Telefonnummer hinterlegt.</p>
        <button className="pressable w-full py-4 rounded-2xl font-bold bg-gray-100 text-gray-600" onClick={onClose}>Schließen</button>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet onClose={onClose} className="px-5 pb-8">
      {step === 'reach' ? (
        <>
          <p className="text-sm font-bold text-gray-900 mb-4">Wie lief der Anruf?</p>
          <div className="flex flex-col gap-2 mb-4">
            {[
              { id: 'erreicht',       label: 'Erreicht',        bg: '#D1FAE5', text: '#065F46' },
              { id: 'mailbox',        label: 'Mailbox',         bg: '#F3F4F6', text: '#374151' },
              { id: 'nicht_erreicht', label: 'Nicht erreicht',  bg: '#FEE2E2', text: '#991B1B' },
            ].map(o => (
              <button
                key={o.id}
                className="pressable py-3.5 rounded-xl text-sm font-bold transition-all"
                style={reachability === o.id
                  ? { background: o.text, color: '#fff' }
                  : { background: o.bg, color: o.text }}
                onClick={() => handleSelectReachability(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {(reachability === 'mailbox' || reachability === 'nicht_erreicht') && (
            <>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none resize-none mb-4"
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Notiz (optional)"
              />
              <button
                className="pressable w-full py-4 rounded-2xl font-bold text-white bg-amber-400 disabled:opacity-50"
                disabled={saving}
                onClick={handleConfirmReach}
              >
                Speichern
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <button
            className="pressable text-amber-500 text-sm font-semibold mb-3"
            onClick={() => { setStep('reach'); setResult(null); setDate('') }}
          >
            ← Zurück
          </button>
          <p className="text-sm font-bold text-gray-900 mb-4">Was war das Ergebnis?</p>
          <div className="flex flex-col gap-2 mb-4">
            {[
              { id: 'termin',         label: 'Termin vereinbart', bg: '#D1FAE5', text: '#065F46' },
              { id: 'kein_int',       label: 'Kein Interesse',    bg: '#FEE2E2', text: '#991B1B' },
              { id: 'spaeter',        label: 'Später nochmal',    bg: '#EFF6FF', text: '#1D4ED8' },
              { id: 'falsche_nummer', label: 'Falsche Nummer',    bg: '#F3F4F6', text: '#374151' },
            ].map(o => (
              <button
                key={o.id}
                className="pressable py-3.5 rounded-xl text-sm font-bold transition-all"
                style={result === o.id
                  ? { background: o.text, color: '#fff' }
                  : { background: o.bg, color: o.text }}
                onClick={() => { setResult(o.id); setDate('') }}
              >
                {o.label}
              </button>
            ))}
          </div>
          {result === 'termin' && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Terminzeit *</p>
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          )}
          {result === 'spaeter' && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Wiedervorlage *</p>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          )}
          <button
            className="pressable w-full py-4 rounded-2xl font-bold text-white bg-amber-400 disabled:opacity-50"
            disabled={!canConfirmResult || saving}
            onClick={handleConfirmResult}
          >
            Speichern
          </button>
        </>
      )}
    </BottomSheet>
  )
}
