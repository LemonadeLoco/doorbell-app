import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useStats } from '../hooks/useStats'
import { GebieteScreen } from './GebieteScreen'
import { WEEKDAYS_DE } from '../lib/constants'

const RANGES = [
  { id: 'today', label: 'Heute' },
  { id: 'week',  label: 'Woche' },
  { id: 'month', label: 'Monat' },
  { id: 'gesamt',label: 'Gesamt' },
]

function rangeStart(range) {
  const now = new Date()
  if (range === 'today') { const d = new Date(now); d.setHours(0,0,0,0); return d }
  if (range === 'week')  { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d }
  if (range === 'month') { const d = new Date(now); d.setDate(1); d.setHours(0,0,0,0); return d }
  return null
}

function workingDays(range) {
  const start = rangeStart(range)
  if (!start) return 30
  const diff = Math.max(1, Math.ceil((Date.now() - start.getTime()) / 86400000))
  return diff
}

export function StatsScreen({ userSettings }) {
  const [range, setRange] = useState('month')
  const [tab, setTab]     = useState('stats')
  const { stats } = useStats(range, userSettings)

  const [extended, setExtended] = useState(null)

  useEffect(() => { loadExtended() }, [range])

  const loadExtended = async () => {
    const start = rangeStart(range)
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const [tapRes, weekRes, salesRes, contactRes] = await Promise.all([
      supabase.from('door_taps').select('tapped_at, outcome, address').gte('tapped_at', start ? start.toISOString() : '2000-01-01'),
      supabase.from('door_taps').select('tapped_at').gte('tapped_at', sevenAgo),
      supabase.from('contacts').select('sale_amount, added_at, product').eq('status', 'verkauft'),
      supabase.from('contacts').select('added_at, status').gte('added_at', sevenAgo),
    ])

    const taps = tapRes.data ?? []
    const weekTaps = weekRes.data ?? []
    const sales = salesRes.data ?? []
    const contacts7 = contactRes.data ?? []

    // Weekly chart: last 7 days
    const today = new Date(); today.setHours(0,0,0,0)
    const weekChart = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getTime() - (6 - i) * 86400000)
      const dStr = d.toISOString().split('T')[0]
      const doors = weekTaps.filter(t => t.tapped_at?.startsWith(dStr)).length
      const hasSale = contacts7.some(c => c.added_at?.startsWith(dStr) && c.status === 'verkauft')
      return { label: WEEKDAYS_DE[d.getDay()], doors, hasSale }
    })

    // Best weekday (all time)
    const byWd = {}
    taps.forEach(t => {
      const wd = new Date(t.tapped_at).getDay()
      byWd[wd] = (byWd[wd] ?? 0) + 1
    })
    const bestWd = Object.entries(byWd).sort(([,a],[,b]) => b - a)[0]
    const bestDayLabel = bestWd ? WEEKDAYS_DE[parseInt(bestWd[0])] : null

    // Current streak (days with door taps)
    let streak = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getTime() - i * 86400000)
      const dStr = d.toISOString().split('T')[0]
      const hasTap = weekTaps.some(t => t.tapped_at?.startsWith(dStr))
      if (hasTap) { streak++ }
      else if (i > 0) break
    }

    // Top street
    const streetCount = {}
    taps.filter(t => t.address).forEach(t => {
      const street = t.address.split(',')[0]?.replace(/\s+\d+[a-z]?\s*$/i, '').trim()
      if (street) streetCount[street] = (streetCount[street] ?? 0) + 1
    })
    const topStreet = Object.entries(streetCount).sort(([,a],[,b]) => b - a)[0]?.[0] ?? null

    // Products breakdown
    const prodCount = {}
    sales.forEach(s => { if (s.product) prodCount[s.product] = (prodCount[s.product] ?? 0) + 1 })
    const products = Object.entries(prodCount).sort(([,a],[,b]) => b - a).slice(0, 5)

    setExtended({ weekChart, bestDayLabel, streak, topStreet, products })
  }

  const target = userSettings?.revenue_target ?? 700000
  const base   = userSettings?.revenue_base   ?? 0
  const total  = base + (stats?.salesRevenue ?? 0)
  const pct    = Math.min(100, Math.round((total / target) * 100))
  const fmt    = (n) => '€' + Math.round(n).toLocaleString('de-DE')

  const days       = workingDays(range)
  const doorsPerDay = stats?.doors ? Math.round(stats.doors / days * 10) / 10 : 0
  const avgTicket  = stats?.verkauft ? Math.round((stats?.salesRevenue ?? 0) / stats.verkauft) : 0
  const provision  = Math.round((stats?.salesRevenue ?? 0) * 0.1)

  const funnelSteps = stats ? [
    { label: 'Türen',      value: stats.doors,    prev: null,          color: '#9CA3AF' },
    { label: 'Gespräche',  value: stats.convs,    prev: stats.doors,   color: '#3B82F6' },
    { label: 'Kontakte',   value: stats.kontakte, prev: stats.convs,   color: '#F59E0B' },
    { label: 'Termine',    value: stats.termine,  prev: stats.kontakte,color: '#10B981' },
    { label: 'Abschlüsse', value: stats.verkauft, prev: stats.termine, color: '#8B5CF6' },
  ] : []
  const maxFunnel = Math.max(1, funnelSteps[0]?.value ?? 1)

  return (
    <div className="flex flex-col min-h-screen pb-28">
      <div className="bg-white px-4 pt-5 pb-3 shadow-sm">
        <h1 className="text-xl font-extrabold text-gray-900 mb-3">Statistiken</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-3">
          {[{ id: 'stats', label: 'Statistiken' }, { id: 'gebiete', label: 'Gebiete' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all pressable"
              style={tab === t.id ? { background: '#F59E0B', color: '#fff' } : { color: '#9CA3AF' }}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'stats' && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {RANGES.map(r => (
              <button key={r.id} onClick={() => setRange(r.id)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all pressable"
                style={range === r.id ? { background: '#F59E0B', color: '#fff' } : { color: '#9CA3AF' }}>
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'gebiete' ? <GebieteScreen /> : (
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* Revenue */}
          <div className="rounded-2xl p-5 text-white shadow-md" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Umsatzziel</p>
            <div className="flex items-end justify-between mb-3">
              <span className="text-3xl font-extrabold">{fmt(total)}</span>
              <span className="text-sm opacity-75">/ {fmt(target)}</span>
            </div>
            <div className="h-2 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs mt-2 opacity-80">{pct}% erreicht</p>
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Türen/Tag', value: doorsPerDay },
              { label: 'Abschlüsse', value: stats?.verkauft ?? 0 },
              { label: 'Ø Ticket', value: avgTicket > 0 ? fmt(avgTicket) : '—' },
              { label: 'Provision', value: provision > 0 ? fmt(provision) : '—' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl p-3 shadow-sm text-center">
                <p className="text-base font-extrabold text-gray-900 leading-tight">{c.value}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Funnel */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Conversion-Trichter</p>
            {funnelSteps.map(step => {
              const barPct  = Math.round((step.value / maxFunnel) * 100)
              const convPct = step.prev != null && step.prev > 0 ? Math.round(step.value / step.prev * 100) : null
              return (
                <div key={step.label} className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-gray-700">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{step.value}</span>
                      {convPct !== null && <span className="text-xs text-gray-400">{convPct}%</span>}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, background: step.color }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Weekly chart */}
          {extended?.weekChart && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Letzte 7 Tage</p>
              <WeeklyChart data={extended.weekChart} />
            </div>
          )}

          {/* Insights */}
          {extended && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Insights</p>
              {[
                extended.bestDayLabel && { icon: '📅', label: 'Bester Tag', value: extended.bestDayLabel },
                extended.streak > 0   && { icon: '🔥', label: 'Aktuelle Serie', value: `${extended.streak} Tag${extended.streak !== 1 ? 'e' : ''} aktiv` },
                extended.topStreet    && { icon: '🏠', label: 'Meistgeklingelt', value: extended.topStreet },
              ].filter(Boolean).map(item => (
                <div key={item.label} className="flex items-center gap-3 py-1.5">
                  <span>{item.icon}</span>
                  <span className="text-sm text-gray-500 flex-1">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Product breakdown */}
          {extended?.products?.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Produkte (Abschlüsse)</p>
              {extended.products.map(([product, count]) => {
                const total = extended.products.reduce((s, [,c]) => s + c, 0)
                const barW  = Math.round((count / total) * 100)
                return (
                  <div key={product} className="mb-2.5">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{product}</span>
                      <span className="text-gray-400">{count} ({barW}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WeeklyChart({ data }) {
  const max   = Math.max(...data.map(d => d.doors), 1)
  const H     = 64
  const BAR_W = 28
  const GAP   = 8
  const W     = (BAR_W + GAP) * 7 - GAP

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H + 28} style={{ display: 'block', margin: '0 auto' }}>
        {data.map((d, i) => {
          const barH = Math.max(4, Math.round((d.doors / max) * H))
          const x    = i * (BAR_W + GAP)
          return (
            <g key={i}>
              <rect x={x} y={H - barH} width={BAR_W} height={barH} rx="5" fill="#F59E0B" opacity={d.doors === 0 ? 0.25 : 1} />
              {d.hasSale && <circle cx={x + BAR_W / 2} cy={H - barH - 7} r="4" fill="#10B981" />}
              <text x={x + BAR_W / 2} y={H + 16} textAnchor="middle" fontSize="11" fill="#9CA3AF">{d.label}</text>
              {d.doors > 0 && (
                <text x={x + BAR_W / 2} y={H - barH - (d.hasSale ? 16 : 5)} textAnchor="middle" fontSize="9" fill="#6B7280">{d.doors}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
