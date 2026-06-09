import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const OUTCOME_CONFIG = {
  nicht_da:  { label: 'Nicht da',        color: '#9CA3AF' },
  kein_int:  { label: 'Kein Interesse',  color: '#EF4444' },
  gesprach:  { label: 'Gespräch',        color: '#3B82F6' },
  kontakt:   { label: 'Kontakt',         color: '#F59E0B' },
  termin:    { label: 'Termin',          color: '#10B981' },
}

function groupByDate(taps) {
  const groups = {}
  for (const tap of taps) {
    const day = new Date(tap.tapped_at).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups[day]) groups[day] = []
    groups[day].push(tap)
  }
  return groups
}

export function GebieteScreen() {
  const [taps, setTaps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('door_taps')
      .select('*, contact:contact_id(name, status)')
      .order('tapped_at', { ascending: false })
      .limit(200)
    setTaps(data ?? [])
    setLoading(false)
  }

  if (loading) return <p className="text-center text-gray-400 mt-12 text-sm">Laden...</p>

  const withAddress = taps.filter(t => t.address)
  if (withAddress.length === 0) {
    return (
      <div className="text-center mt-16 px-6">
        <p className="text-3xl mb-3">🗺️</p>
        <p className="text-gray-500 font-semibold text-sm">Noch keine Gebiets-Daten</p>
        <p className="text-gray-400 text-xs mt-2 leading-relaxed">
          Adressen werden automatisch erfasst, sobald GPS beim Tippen aktiv ist.
        </p>
      </div>
    )
  }

  const groups = groupByDate(withAddress)

  return (
    <div className="px-4 py-4 flex flex-col gap-5">
      {Object.entries(groups).map(([day, dayTaps]) => (
        <div key={day}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{day}</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
            {dayTaps.map(tap => {
              const cfg = OUTCOME_CONFIG[tap.outcome] ?? { label: tap.outcome, color: '#9CA3AF' }
              return (
                <div key={tap.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: cfg.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{tap.address}</p>
                    <p className="text-xs mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
                    {tap.contact && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        → {tap.contact.name}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-300 flex-shrink-0 mt-0.5">
                    {new Date(tap.tapped_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
