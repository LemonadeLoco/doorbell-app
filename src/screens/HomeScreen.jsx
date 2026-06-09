import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function HomeScreen({ setScreen, sessionData, userSettings }) {
  const [todayStats, setTodayStats] = useState({ doors: 0, convs: 0, contacts: 0, appts: 0 })
  const [upcoming, setUpcoming]     = useState([])
  const [callCount, setCallCount]   = useState(0)
  const [salesRevenue, setSalesRevenue] = useState(0)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  }
  const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => { loadAll() }, [])

  const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() }

  const loadAll = async () => {
    const [callRes, upcomingRes, tapRes, salesRes] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('status', 'anrufen'),
      supabase.from('contacts').select('name, appt_at')
        .eq('status', 'termin')
        .gte('appt_at', new Date().toISOString())
        .lte('appt_at', new Date(Date.now() + 2 * 86400000).toISOString())
        .order('appt_at'),
      supabase.from('door_taps').select('outcome').gte('tapped_at', todayStart()),
      supabase.from('contacts').select('sale_amount').eq('status', 'verkauft'),
    ])

    setCallCount(callRes.count ?? 0)
    setUpcoming(upcomingRes.data ?? [])
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

      {/* To-do */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Offene Aufgaben</p>
        <button className="flex items-center justify-between w-full mb-2" onClick={() => setScreen('pipeline')}>
          <span className="text-sm text-gray-700">📞 Zum Anrufen</span>
          <span className="text-sm font-bold text-blue-600">{callCount}</span>
        </button>
        {upcoming.length > 0 && (
          <div className="border-t border-gray-100 pt-3 mt-2">
            <p className="text-xs text-gray-400 mb-2">Bevorstehende Termine</p>
            {upcoming.map((c, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span className="text-gray-700 font-medium">{c.name}</span>
                <span className="text-gray-400">
                  {new Date(c.appt_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
