import { useState } from 'react'
import { ContactSheet } from '../components/ContactSheet'
import { Toast, useToast } from '../components/Toast'
import { useGPS } from '../hooks/useGPS'
import { supabase } from '../lib/supabase'

export function RundeScreen({ sessionHook }) {
  const {
    session, isActive, formatElapsed,
    startSession, endSession,
    incrementDoors, incrementConvs,
    incrementContacts, incrementAppts,
  } = sessionHook

  const [sheet, setSheet] = useState(null)
  const { toast, show } = useToast()
  const { captureAndSave, getPosition } = useGPS()

  const tap = (outcome, extra = {}) => {
    incrementDoors()
    if (outcome === 'gesprach') incrementConvs()
    if (session) captureAndSave(session.id, outcome, extra.contactId ?? null)
  }

  const handleNichtDa  = () => { tap('nicht_da'); show('📍 Standort gespeichert') }
  const handleKeinInt  = () => { tap('kein_int');  show('Notiert') }
  const handleGesprach = () => { tap('gesprach');  show('Gespräch notiert') }

  const handleSaveContact = async (data) => {
    const isTermin = sheet === 'termin'
    setSheet(null)
    try {
      const { data: contact } = await supabase.from('contacts').insert({
        ...data,
        source: 'tür',
        session_id: session?.id ?? null,
      }).select().single()

      incrementDoors()
      incrementContacts()
      if (isTermin) incrementAppts()
      if (session) captureAndSave(session.id, isTermin ? 'termin' : 'kontakt', contact?.id ?? null)
      show(isTermin ? '✅ Termin gespeichert' : '✅ Kontakt gespeichert')
    } catch {
      show('Fehler beim Speichern')
    }
  }

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-28 gap-6">
        <div className="text-center">
          <p className="text-5xl mb-4">🚪</p>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Runde starten</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Erfasse Türkontakte live — GPS, Gespräche und Termine mit einem Tippen.
          </p>
        </div>
        <button
          className="btn-press w-full py-5 rounded-2xl font-bold text-white text-lg shadow-lg"
          style={{ background: '#F59E0B' }}
          onClick={startSession}
        >
          ▲ Runde starten
        </button>
        <Toast toast={toast} />
      </div>
    )
  }

  const doors    = session._doors    ?? 0
  const convs    = session._convs    ?? 0
  const contacts = session._contacts ?? 0
  const appts    = session._appts    ?? 0

  const outcomes = [
    { label: 'Nicht da',        sub: 'GPS auto ✓',       bg: '#E5E7EB', text: '#374151', icon: '🚪', action: handleNichtDa },
    { label: 'Kein Interesse',  sub: 'Direkt notieren',  bg: '#FEE2E2', text: '#991B1B', icon: '✖',  action: handleKeinInt },
    { label: 'Gespräch geführt',sub: 'Zählt als Gespräch',bg: '#DBEAFE',text: '#1E40AF', icon: '💬', action: handleGesprach },
    { label: 'Kontakt notiert', sub: 'Formular öffnen',  bg: '#FEF3C7', text: '#92400E', icon: '📋', action: () => setSheet('kontakt') },
    { label: 'Termin gesetzt',  sub: 'Mit Datum & Zeit', bg: '#D1FAE5', text: '#065F46', icon: '📅', action: () => setSheet('termin') },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 pb-24">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <span className="pulse-dot w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span className="text-white text-sm font-semibold">Runde läuft</span>
        </div>
        <span className="text-white font-mono text-sm bg-gray-800 px-3 py-1 rounded-full">{formatElapsed()}</span>
      </div>

      <div className="text-center py-6">
        <p className="text-8xl font-black text-white leading-none">{doors}</p>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mt-1">Türen</p>
      </div>

      <div className="grid grid-cols-3 mx-4 bg-gray-800 rounded-2xl overflow-hidden mb-2">
        {[
          { label: 'Gespräche', value: convs },
          { label: 'Kontakte',  value: contacts },
          { label: 'Termine',   value: appts },
        ].map((s, i) => (
          <div key={s.label} className={`flex flex-col items-center py-3 ${i < 2 ? 'border-r border-gray-700' : ''}`}>
            <span className="text-2xl font-extrabold text-white">{s.value}</span>
            <span className="text-gray-400 text-xs uppercase tracking-wide">{s.label}</span>
          </div>
        ))}
      </div>

      <p className="text-center text-gray-500 text-xs py-2">📍 Standort läuft im Hintergrund</p>

      <div className="flex flex-col gap-2 px-4 mt-2">
        {outcomes.map(o => (
          <button
            key={o.label}
            className="btn-press flex items-center gap-3 px-4 rounded-2xl"
            style={{ minHeight: 64, background: o.bg, color: o.text }}
            onClick={o.action}
          >
            <span className="text-xl w-8 text-center flex-shrink-0">{o.icon}</span>
            <div className="flex-1 text-left">
              <p className="font-bold text-sm">{o.label}</p>
              <p className="text-xs opacity-60">{o.sub}</p>
            </div>
            <span className="text-lg opacity-40">›</span>
          </button>
        ))}
      </div>

      <button
        className="btn-press mx-4 mt-5 py-3 text-gray-400 text-sm font-medium text-center"
        onClick={endSession}
      >
        Runde beenden
      </button>

      {sheet && (
        <ContactSheet
          mode={sheet}
          onSave={handleSaveContact}
          onClose={() => setSheet(null)}
          getPosition={getPosition}
        />
      )}
      <Toast toast={toast} />
    </div>
  )
}
