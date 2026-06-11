import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LiveTeamFeed } from '../components/LiveTeamFeed'
import { CallOutcomeOverlay } from '../components/CallOutcomeOverlay'
import { DoorMap } from '../components/DoorMap'

export function HomeScreen({ setScreen, sessionData, userSettings, onContactSelect }) {
  const [todayStats, setTodayStats] = useState({ doors: 0, convs: 0, contacts: 0, appts: 0 })
  const [todayAppts, setTodayAppts] = useState([])
  const [todayFollowups, setTodayFollowups] = useState([])
  const [callCount, setCallCount]   = useState(0)
  const [salesRevenue, setSalesRevenue] = useState(0)
  const [todayApptCount, setTodayApptCount] = useState(0)
  const [callOverlayContact, setCallOverlayContact] = useState(null)
  const [showMap, setShowMap] = useState(false)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  }
  const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => { loadAll() }, [])

  const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() }
  const todayStr   = new Date().toISOString().split('T')[0]

  const loadAll = async () => {
    const [callRes, apptRes, followupRes, tapRes, salesRes] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('status', 'anrufen'),
      supabase.from('contacts')
        .select('*')
        .eq('status', 'termin')
        .gte('appt_at', todayStart())
        .lte('appt_at', new Date(new Date().setHours(23,59,59,999)).toISOString())
        .order('appt_at'),
      supabase.from('contacts')
        .select('*')
        .eq('status', 'wiedervorlage')
        .lte('followup_at', todayStr)
        .order('followup_at', { ascending: true }),
      supabase.from('door_taps').select('outcome').gte('tapped_at', todayStart()),
      supabase.from('contacts').select('sale_amount').eq('status', 'verkauft'),
    ])

    setCallCount(callRes.count ?? 0)
    setTodayAppts(apptRes.data ?? [])
    setTodayFollowups(followupRes.data ?? [])
    setSalesRevenue((salesRes.data ?? []).reduce((s, c) => s + (parseFloat(c.sale_amount) || 0), 0))

    const taps = tapRes.data ?? []
    const contactsRes = await supabase.from('contacts').select('status').gte('added_at', todayStart())
    const cts = contactsRes.data ?? []

    const base = {
      doors:    taps.length,
      convs:    taps.filter(t => ['gesprach','kontakt','termin'].includes(t.outcome)).length,
      contacts: cts.filter(c => ['anrufen','kontakt'].includes(c.status)).length,
      appts:    cts.filter(c => c.status === 'termin').length,
    }

    setTodayApptCount((apptRes.data ?? []).length)

    if (sessionData?.isActive) {
      setTodayStats({
        doors:    sessionData.session._doors    ?? base.doors,
        convs:    sessionData.session._convs    ?? base.convs,
        contacts: sessionData.session._contacts ?? base.contacts,
        appts:    sessionData.session._appts    ?? base.appts,
      })
    } else {
      setTodayStats(base)
    }
  }

  const target  = userSettings?.revenue_target ?? 700000
  const base    = userSettings?.revenue_base   ?? 0
  const total   = base + salesRevenue
  const pct     = Math.min(100, Math.round((total / target) * 100))
  const fmt     = (n) => '€' + Math.round(n).toLocaleString('de-DE')

  const nextAppt = todayAppts[0]
  const nextApptTime = nextAppt?.appt_at
    ? new Date(nextAppt.appt_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null

  const hasHeuteFaellig = todayAppts.length > 0 || todayFollowups.length > 0

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">{dateLabel}</p>
          <h1 className="text-xl font-extrabold text-gray-900">{greeting()} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMap(true)}
            className="btn-press w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400"
          >
            🗺️
          </button>
          <button
            onClick={() => setScreen('settings')}
            className="btn-press w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Live Team Feed */}
      <LiveTeamFeed />

      {/* Revenue card */}
      <div className="rounded-2xl p-5 text-white shadow-md" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Umsatzziel 2025</p>
        <div className="flex items-end justify-between mb-3">
          <span className="text-3xl font-extrabold">{fmt(total)}</span>
          <span className="text-sm opacity-75">/ {fmt(target)}</span>
        </div>
        <div className="h-2 bg-white/30 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs mt-2 opacity-80">{pct}% erreicht</p>
      </div>

      {/* Today appointments banner */}
      {todayApptCount > 0 && (
        <button
          className="pressable flex items-center gap-3 w-full rounded-2xl px-4 py-3 shadow-sm text-left"
          style={{ background: '#FEF3C7' }}
          onClick={() => setScreen('pipeline')}
        >
          <span className="text-lg">📅</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              Heute {todayApptCount} Termin{todayApptCount !== 1 ? 'e' : ''}
              {nextApptTime ? ` · Nächster: ${nextApptTime}` : ''}
            </p>
          </div>
          <span className="text-amber-600 font-bold">→</span>
        </button>
      )}

      {/* Today stats */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Heute</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Türen',      value: todayStats.doors,    color: '#6B7280' },
            { label: 'Gespräche',  value: todayStats.convs,    color: '#1E40AF' },
            { label: 'Kontakte',   value: todayStats.contacts, color: '#92400E' },
            { label: 'Termine',    value: todayStats.appts,    color: '#065F46' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-3xl font-extrabold" style={{ color: item.color }}>{item.value}</p>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn-press w-full py-4 rounded-2xl bg-amber-400 text-white font-bold text-base shadow-md"
        onClick={() => setScreen('runde')}
      >
        {sessionData?.isActive ? '▶ Runde läuft — Öffnen' : '▲ Runde starten'}
      </button>

      {/* Heute fällig */}
      {hasHeuteFaellig && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Heute fällig</p>

          {todayAppts.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Termine</p>
              {todayAppts.map((c) => (
                <button
                  key={c.id}
                  className="pressable flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 w-full text-left"
                  onClick={() => onContactSelect?.(c)}
                >
                  <span className="text-base flex-shrink-0">📅</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    {c.address && <p className="text-xs text-gray-400 truncate">{c.address}</p>}
                  </div>
                  <span className="text-sm font-bold text-green-700 flex-shrink-0">
                    {new Date(c.appt_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </span>
                </button>
              ))}
            </div>
          )}

          {todayFollowups.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Anrufen</p>
              {todayFollowups.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <button
                    className="pressable flex-1 text-left min-w-0"
                    onClick={() => onContactSelect?.(c)}
                  >
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    {c.followup_at && (
                      <p className="text-xs text-blue-500">
                        {new Date(c.followup_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.phone && (
                      <a
                        href={`tel:${c.phone.replace(/\s/g,'')}`}
                        className="pressable text-green-600 text-sm px-2 py-1 rounded-lg bg-green-50"
                        onClick={e => e.stopPropagation()}
                      >
                        📞
                      </a>
                    )}
                    {c.phone && (
                      <button
                        className="pressable text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-500"
                        onClick={() => setCallOverlayContact(c)}
                      >
                        Anruf
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Open tasks */}
      {callCount > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Offene Aufgaben</p>
          <button className="flex items-center justify-between w-full" onClick={() => setScreen('pipeline')}>
            <span className="text-sm text-gray-700">📞 Zum Anrufen</span>
            <span className="text-sm font-bold text-blue-600">{callCount}</span>
          </button>
        </div>
      )}

      {/* Call Outcome Overlay */}
      {callOverlayContact && (
        <CallOutcomeOverlay
          contact={callOverlayContact}
          onClose={() => { setCallOverlayContact(null); loadAll() }}
        />
      )}

      {showMap && <DoorMap onClose={() => setShowMap(false)} />}
    </div>
  )
}
