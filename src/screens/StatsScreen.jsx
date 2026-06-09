import { useState } from 'react'
import { useStats } from '../hooks/useStats'
import { GebieteScreen } from './GebieteScreen'

const RANGES = [
  { id: 'today',  label: 'Heute' },
  { id: 'week',   label: 'Woche' },
  { id: 'month',  label: 'Monat' },
  { id: 'gesamt', label: 'Gesamt' },
]

export function StatsScreen({ userSettings }) {
  const [range, setRange] = useState('gesamt')
  const [tab, setTab]     = useState('stats')
  const { stats } = useStats(range, userSettings)

  const target  = userSettings?.revenue_target ?? 700000
  const base    = userSettings?.revenue_base   ?? 0
  const total   = base + (stats?.salesRevenue ?? 0)
  const pct     = Math.min(100, Math.round((total / target) * 100))
  const fmt     = (n) => '€' + Math.round(n).toLocaleString('de-DE')

  const funnelSteps = stats ? [
    { label: 'Türen',      value: stats.doors,    prev: null,         color: '#9CA3AF' },
    { label: 'Gespräche',  value: stats.convs,    prev: stats.doors,  color: '#3B82F6' },
    { label: 'Kontakte',   value: stats.kontakte, prev: stats.convs,  color: '#F59E0B' },
    { label: 'Termine',    value: stats.termine,  prev: stats.kontakte, color: '#10B981' },
    { label: 'Abschlüsse', value: stats.verkauft, prev: stats.termine,  color: '#8B5CF6' },
  ] : []

  const maxVal = Math.max(1, funnelSteps[0]?.value ?? 1)

  const convCards = stats ? [
    { label: 'Tür → Gespräch',     pct: stats.doors    > 0 ? Math.round(stats.convs    / stats.doors    * 100) : 0 },
    { label: 'Gespräch → Kontakt', pct: stats.convs    > 0 ? Math.round(stats.kontakte / stats.convs    * 100) : 0 },
    { label: 'Kontakt → Termin',   pct: stats.kontakte > 0 ? Math.round(stats.termine  / stats.kontakte * 100) : 0 },
    { label: 'Termin → Abschluss', pct: stats.termine  > 0 ? Math.round(stats.verkauft / stats.termine  * 100) : 0 },
  ] : []

  return (
    <div className="flex flex-col min-h-screen pb-28">
      <div className="bg-white px-4 pt-5 pb-3 shadow-sm">
        <h1 className="text-xl font-extrabold text-gray-900 mb-3">Statistiken</h1>
        {/* Tab toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-3">
          {[{ id: 'stats', label: 'Statistiken' }, { id: 'gebiete', label: 'Gebiete' }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={tab === t.id ? { background: '#F59E0B', color: '#fff' } : { color: '#9CA3AF' }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'stats' && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={range === r.id ? { background: '#F59E0B', color: '#fff' } : { color: '#9CA3AF' }}
              >
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

          {/* Funnel */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Conversion-Trichter</p>
            {funnelSteps.map(step => {
              const barPct  = maxVal > 0 ? Math.round((step.value / maxVal) * 100) : 0
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

          {/* Conversion cards */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Conversion-Raten</p>
            <div className="grid grid-cols-2 gap-3">
              {convCards.map(c => (
                <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-2xl font-extrabold text-gray-900">{c.pct}%</p>
                  <p className="text-xs text-gray-400 font-medium mt-1 leading-snug">{c.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
