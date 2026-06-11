import { useState, useRef, useEffect } from 'react'
import { ContactSheet } from '../components/ContactSheet'
import { Toast, useToast } from '../components/Toast'
import { useGPS } from '../hooks/useGPS'
import { reverseGeocode } from '../lib/geocode'
import { supabase } from '../lib/supabase'
import { OFFLINE_TAPS_KEY } from '../lib/constants'

// Small haptic pulse
const haptic = (type = 'light') => {
  if (!navigator.vibrate) return
  navigator.vibrate({ light: 10, medium: 25, heavy: 50 }[type] ?? 10)
}

export function RundeScreen({ sessionHook }) {
  const {
    session, isActive, formatElapsed,
    startSession, endSession,
    incrementDoors, incrementConvs, incrementContacts, incrementAppts,
    decrementDoors, decrementConvs, decrementContacts, decrementAppts,
  } = sessionHook

  const [sheet, setSheet]         = useState(null) // null | 'kontakt' | 'termin' | 'wiedervorlage'
  const [tapToast, setTapToast]   = useState(null) // { msg, address, loading, tapId, contactId, outcome }
  const toastDismissTimer = useRef(null)
  const [doorKey, setDoorKey]     = useState(0)    // key change triggers counter animation
  const [convKey, setConvKey]     = useState(0)
  const [contactKey, setContactKey] = useState(0)
  const [apptKey, setApptKey]     = useState(0)
  const [offlineCount, setOfflineCount] = useState(0)
  const [isOnline, setIsOnline]   = useState(navigator.onLine)
  const [cooldowns, setCooldowns] = useState({}) // outcome -> disabled until
  const undoTimer = useRef(null)
  const lastTapTime = useRef({})
  const { toast, show }           = useToast()
  const { getPosition }           = useGPS()

  useEffect(() => {
    const on  = () => { setIsOnline(true);  syncOffline() }
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem(OFFLINE_TAPS_KEY)
    setOfflineCount(raw ? JSON.parse(raw).length : 0)
  }, [])

  const syncOffline = async () => {
    try {
      const raw = localStorage.getItem(OFFLINE_TAPS_KEY)
      if (!raw) return
      const taps = JSON.parse(raw)
      if (!taps.length) return
      await supabase.from('door_taps').insert(taps.map(({ _localId, ...rest }) => rest))
      localStorage.removeItem(OFFLINE_TAPS_KEY)
      setOfflineCount(0)
    } catch {}
  }

  const saveTap = async (outcome, contactId = null) => {
    const tapData = {
      session_id:  session?.id ?? null,
      outcome,
      contact_id:  contactId,
      tapped_at:   new Date().toISOString(),
      lat: null, lng: null, address: null,
    }

    if (!navigator.onLine) {
      const pending = JSON.parse(localStorage.getItem(OFFLINE_TAPS_KEY) || '[]')
      const localId = `local_${Date.now()}`
      pending.push({ ...tapData, _localId: localId })
      localStorage.setItem(OFFLINE_TAPS_KEY, JSON.stringify(pending))
      setOfflineCount(pending.length)
      return { tapId: null, localId }
    }

    const { data } = await supabase.from('door_taps').insert(tapData).select('id').single()
    const tapId = data?.id

    // Get GPS + address in background
    if (navigator.geolocation && tapId) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          const address = await reverseGeocode(lat, lng)
          await supabase.from('door_taps').update({ lat, lng, address }).eq('id', tapId)
          setTapToast(prev => prev?.tapId === tapId ? { ...prev, address, loading: false } : prev)
        },
        () => setTapToast(prev => prev?.tapId === tapId ? { ...prev, loading: false } : prev),
        { timeout: 5000, maximumAge: 30000 }
      )
    } else {
      setTapToast(prev => prev ? { ...prev, loading: false } : null)
    }

    return { tapId }
  }

  const handleTap = async (outcome, extra = {}) => {
    haptic('light')
    incrementDoors(); setDoorKey(k => k + 1)
    if (outcome === 'gesprach') { incrementConvs(); setConvKey(k => k + 1) }

    const { tapId } = await saveTap(outcome, extra.contactId ?? null)

    // Show GPS toast + undo — auto-dismiss after 5s
    setTapToast({ outcome, tapId, contactId: extra.contactId ?? null, address: null, loading: !!tapId })
    clearTimeout(toastDismissTimer.current)
    toastDismissTimer.current = setTimeout(() => setTapToast(null), 5000)
  }

  const handleUndo = async () => {
    if (!tapToast) return
    clearTimeout(undoTimer.current)
    clearTimeout(toastDismissTimer.current)

    // Delete tap
    if (tapToast.tapId) {
      await supabase.from('door_taps').delete().eq('id', tapToast.tapId)
    }
    // Delete contact if one was created
    if (tapToast.contactId) {
      await supabase.from('contacts').delete().eq('id', tapToast.contactId)
    }

    // Undo counters
    decrementDoors(); setDoorKey(k => k + 1)
    if (tapToast.outcome === 'gesprach')    { decrementConvs(); setConvKey(k => k + 1) }
    if (['kontakt','termin','wiedervorlage'].includes(tapToast.outcome)) { decrementContacts(); setContactKey(k => k + 1) }
    if (tapToast.outcome === 'termin')      { decrementAppts(); setApptKey(k => k + 1) }

    setTapToast(null)
    show('Rückgängig gemacht ✓')
  }

  const handleSaveContact = async (data) => {
    const isTermin       = sheet === 'termin'
    const isWiedervorlage = sheet === 'wiedervorlage'
    setSheet(null)
    try {
      haptic('medium')
      const { data: authData } = await supabase.auth.getSession()
      const userId = authData.session?.user?.id ?? null
      const { data: contact } = await supabase.from('contacts').insert({
        ...data, source: 'tür', session_id: session?.id ?? null, user_id: userId,
      }).select().single()

      if (navigator.geolocation && contact?.id) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await supabase.from('contacts').update({ lat: pos.coords.latitude, lng: pos.coords.longitude }).eq('id', contact.id)
          },
          () => {},
          { timeout: 5000, maximumAge: 30000 }
        )
      }

      const outcome = isTermin ? 'termin' : isWiedervorlage ? 'wiedervorlage' : 'kontakt'
      const { tapId } = await saveTap(outcome, contact?.id ?? null)

      incrementDoors(); setDoorKey(k => k + 1)
      incrementContacts(); setContactKey(k => k + 1)
      if (isTermin) { incrementAppts(); setApptKey(k => k + 1) }

      setTapToast({ outcome, tapId, contactId: contact?.id, address: data.address, loading: !data.address })
      clearTimeout(toastDismissTimer.current)
      toastDismissTimer.current = setTimeout(() => setTapToast(null), 5000)

      show(isTermin ? '✅ Termin gespeichert' : isWiedervorlage ? '✅ Wiedervorlage gespeichert' : '✅ Kontakt gespeichert')
    } catch { show('Fehler beim Speichern') }
  }

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-28 gap-6">
        <div className="text-center">
          <p className="text-5xl mb-4">🚪</p>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Runde starten</h2>
          <p className="text-sm text-gray-500 leading-relaxed">GPS, Gespräche und Termine — mit einem Tippen pro Tür.</p>
        </div>
        <button className="pressable w-full py-5 rounded-2xl font-bold text-white text-lg shadow-lg bg-amber-400" onClick={startSession}>
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
    { label: 'Nicht da',        sub: 'GPS auto ✓',        bg: '#E5E7EB', text: '#374151', icon: '🚪', outcome: 'nicht_da' },
    { label: 'Kein Zugang',     sub: 'Klingel / Tor',     bg: '#F3F4F6', text: '#4B5563', icon: '🔒', outcome: 'kein_zugang' },
    { label: 'Kein Interesse',  sub: 'Direkt notieren',   bg: '#FEE2E2', text: '#991B1B', icon: '✖',  outcome: 'kein_int' },
    { label: 'Gespräch geführt',sub: 'Zählt als Gespräch',bg: '#DBEAFE', text: '#1E40AF', icon: '💬', outcome: 'gesprach' },
    { label: 'Wiedervorlage',   sub: 'Kommt wieder in Frage', bg: '#EFF6FF', text: '#1D4ED8', icon: '📅', outcome: 'wiedervorlage', sheet: 'wiedervorlage' },
    { label: 'Kontakt notiert', sub: 'Formular öffnen',   bg: '#FEF3C7', text: '#92400E', icon: '📋', outcome: 'kontakt',      sheet: 'kontakt' },
    { label: 'Termin gesetzt',  sub: 'Mit Datum & Zeit',  bg: '#D1FAE5', text: '#065F46', icon: '📅', outcome: 'termin',       sheet: 'termin' },
  ]

  const toastText = tapToast?.loading
    ? '📍 Standort wird erfasst...'
    : tapToast?.address
    ? `📍 ${tapToast.address.length > 25 ? tapToast.address.slice(0, 25) + '…' : tapToast.address}`
    : '📍 Standort gespeichert'

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <span className="pulse-dot w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span className="text-white text-sm font-semibold">Runde läuft</span>
          {!isOnline && (
            <span className="text-xs bg-red-800 text-red-200 px-2 py-0.5 rounded-full">
              📶 Offline{offlineCount > 0 ? ` — ${offlineCount} ausstehend` : ''}
            </span>
          )}
        </div>
        <span className="text-white font-mono text-sm bg-gray-800 px-3 py-1 rounded-full">{formatElapsed()}</span>
      </div>

      {/* Door counter */}
      <div className="text-center py-5">
        <p key={doorKey} className="text-8xl font-black text-white leading-none counter-pop">{doors}</p>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mt-1">Türen</p>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 mx-4 bg-gray-800 rounded-2xl overflow-hidden mb-1">
        {[
          { label: 'Gespräche', value: convs,    k: convKey },
          { label: 'Kontakte',  value: contacts, k: contactKey },
          { label: 'Termine',   value: appts,    k: apptKey },
        ].map((s, i) => (
          <div key={s.label} className={`flex flex-col items-center py-2.5 ${i < 2 ? 'border-r border-gray-700' : ''}`}>
            <span key={s.k} className="text-2xl font-extrabold text-white stat-pop">{s.value}</span>
            <span className="text-gray-400 text-xs uppercase tracking-wide">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Outcome buttons */}
      <div className="flex flex-col gap-2 px-4 mt-3">
        {outcomes.map(o => {
          const onCooldown = cooldowns[o.outcome] && Date.now() < cooldowns[o.outcome]
          return (
            <button
              key={o.label}
              className="pressable flex items-center gap-3 px-4 rounded-2xl"
              style={{ minHeight: 62, background: o.bg, color: o.text, opacity: onCooldown ? 0.55 : 1 }}
              disabled={onCooldown}
              onClick={() => {
                haptic('light')
                // 600ms cooldown per button
                setCooldowns(prev => ({ ...prev, [o.outcome]: Date.now() + 600 }))
                setTimeout(() => setCooldowns(prev => ({ ...prev, [o.outcome]: 0 })), 600)
                if (o.sheet) setSheet(o.sheet)
                else handleTap(o.outcome)
              }}
            >
              <span className="text-xl w-8 text-center flex-shrink-0">{o.icon}</span>
              <div className="flex-1 text-left">
                <p className="font-bold text-sm">{o.label}</p>
                <p className="text-xs opacity-60">{o.sub}</p>
              </div>
              <span className="text-lg opacity-40">›</span>
            </button>
          )
        })}
      </div>

      <button className="pressable mx-4 mt-5 py-3 text-gray-400 text-sm font-medium text-center" onClick={endSession}>
        Runde beenden
      </button>

      {/* GPS + Undo toast — position:fixed so it can't be clipped by parent overflow */}
      {tapToast && (
        <div
          className="tap-toast-in"
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: 'calc(100vw - 32px)',
            maxWidth: 360,
          }}
        >
          <div className="flex items-center gap-3 bg-gray-800 text-white text-xs px-4 py-3 rounded-2xl shadow-xl">
            <span className="flex-1 truncate">{toastText}</span>
            <button
              onClick={handleUndo}
              className="pressable flex-shrink-0 text-amber-400 font-bold text-xs whitespace-nowrap"
            >
              ↩ Rückgängig
            </button>
          </div>
        </div>
      )}

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
