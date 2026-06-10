import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function HomeScreen({ setScreen, sessionData, userSettings }) {
  const [todayStats, setTodayStats] = useState({ doors: 0, convs: 0, contacts: 0, appts: 0 })
  const [todayAppts, setTodayAppts] = useState([])      // { id, name, address, appt_at }
  const [todayFollowups, setTodayFollowups] = useState([]) // wiedervorlage due today
  const [callCount, setCallCount]   = useState(0)
  const [salesRevenue, setSalesRevenue] = useState(0)
  const [todayApptCount, setTodayApptCount] = useState(0)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  }
  const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => { loadAll() }, [])

  const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() }
  const todayEnd   = () => { const d = new Date(); d.setHours(23,59,59,999); return d.toDateString() }

  const todayStr = new Date().toISOString().split('T')[0]

  const loadAll = async () => {
    const [callRes, apptRes, followupRes, tapRes, salesRes] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('status', 'anrufen'),
      supabase.from('contacts')
        .select('id, name, address, appt_at')
        .eq('status', 'termin')
        .gte('appt_at', todayStart())
        .lte('appt_at', new Date(new Date().setHours(23,59,59,999)).toISOString())
        .order('appt_at'),
      supabase.from('contacts')
        .select('id, name')
        .eq('status', 'wiedervorlage')
        .gte('followup_at', todayStr)
        .lte('followup_at', todayStr),
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

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">{dateLabel}</p>
          <h1 className="text-xl font-extrabold text-gray-900">{greeting()} 👋</h1>
        </div>
        <button
          onClick={() => setScreen('settings')}
          className="btn-press w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400"
        >
          ⚙️
        </button>
      </div>

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

      {/* Today appointments banner — shown when there are appts today */}
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

      {/* Heute — appointments + wiedervorlage */}
      {(todayAppts.length > 0 || todayFollowups.length > 0) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Heute</p>
          {todayAppts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className="text-base">📅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                {c.address && <p className="text-xs text-gray-400 truncate">{c.address}</p>}
              </div>
              <span className="text-sm font-bold text-green-700 flex-shrink-0">
                {new Date(c.appt_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </span>
            </div>
          ))}
          {todayFollowups.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className="text-base">📱</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                <p className="text-xs text-blue-500">Wiedervorlage heute fällig</p>
              </div>
            </div>
          ))}
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
    </div>
  )
}
