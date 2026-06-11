import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { supabase } from '../lib/supabase'

delete L.Icon.Default.prototype._getIconUrl

if (typeof window !== 'undefined') window.L = L

const MUNICH = [48.1351, 11.582]

const OUTCOME_COLORS = {
  termin:        '#22C55E',
  kontakt:       '#3B82F6',
  gesprach:      '#F59E0B',
  nicht_da:      '#9CA3AF',
  kein_int:      '#EF4444',
  kein_zugang:   '#6B7280',
  wiedervorlage: '#8B5CF6',
  nie_wieder:    '#7F1D1D',
}

const OUTCOME_LABELS = {
  termin:        'Termin',
  kontakt:       'Kontakt',
  gesprach:      'Gespräch',
  nicht_da:      'Niemand da',
  kein_int:      'Kein Interesse',
  kein_zugang:   'Kein Zugang',
  wiedervorlage: 'Wiedervorlage',
  nie_wieder:    'Nie wieder',
}

function dotIcon(color) {
  return L.divIcon({
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

function nieWiederIcon() {
  return L.divIcon({
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#7F1D1D;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.35)">🚫</div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function makeLayerGroup() {
  if (typeof L.markerClusterGroup === 'function') {
    return L.markerClusterGroup({ maxClusterRadius: 40, showCoverageOnHover: false })
  }
  return L.layerGroup()
}

function dateCutoff(range) {
  if (range === '7d')  return new Date(Date.now() - 7 * 86400000).toISOString()
  if (range === '30d') return new Date(Date.now() - 30 * 86400000).toISOString()
  return '2000-01-01T00:00:00Z'
}

function buildPopupHtml(tap, repName) {
  const color = OUTCOME_COLORS[tap.outcome] ?? '#9CA3AF'
  const label = OUTCOME_LABELS[tap.outcome] ?? tap.outcome
  const time = new Date(tap.tapped_at).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const nieNote = tap.outcome === 'nie_wieder' && tap.note
    ? `<p style="margin:4px 0 0;color:#991B1B;font-size:11px">🚫 ${tap.note}</p>` : ''
  return `<div style="min-width:160px;font-family:-apple-system,system-ui,sans-serif;font-size:13px;line-height:1.4">
    <p style="font-weight:700;color:#111;margin:0 0 3px">${tap.address ?? '—'}</p>
    <p style="margin:0;color:${color};font-weight:600">${label}</p>
    <p style="margin:2px 0 0;color:#9CA3AF;font-size:11px">${repName ? repName + ' · ' : ''}${time}</p>
    ${nieNote}
  </div>`
}

export function DoorMap({ onClose, embedded = false }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const userMarkerRef = useRef(null)
  const userLatLngRef = useRef(null)

  const [taps, setTaps] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [allRepIds, setAllRepIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [tapCount, setTapCount] = useState(null)
  const [dateRange, setDateRange] = useState('30d')
  const [hiddenOutcomes, setHiddenOutcomes] = useState(new Set())
  const [hiddenReps, setHiddenReps] = useState(new Set())
  const [mapReady, setMapReady] = useState(false)
  const [hasUserLocation, setHasUserLocation] = useState(false)

  // Init map once on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { center: MUNICH, zoom: 12 })
    map.doubleClickZoom.disable()
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map
    setMapReady(true)
    return () => { map.remove(); mapRef.current = null; setMapReady(false) }
  }, [])

  // Fly to user location once map is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        userLatLngRef.current = [latitude, longitude]
        setHasUserLocation(true)
        mapRef.current.flyTo([latitude, longitude], 15, { duration: 1 })

        if (userMarkerRef.current) {
          try { userMarkerRef.current.remove() } catch (_) {}
        }
        userMarkerRef.current = L.circleMarker([latitude, longitude], {
          radius: 8,
          fillColor: '#3B82F6',
          color: '#ffffff',
          weight: 3,
          opacity: 1,
          fillOpacity: 1,
          className: 'user-location-dot',
        })
          .bindTooltip('Mein Standort', { permanent: false })
          .addTo(mapRef.current)
      },
      () => {
        // Permission denied — stay at Munich center
        mapRef.current.setView(MUNICH, 12)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const centerOnUser = () => {
    if (!mapRef.current || !userLatLngRef.current) return
    mapRef.current.flyTo(userLatLngRef.current, 16, { duration: 0.8 })
  }

  // Load data
  const load = useCallback(async () => {
    setLoading(true)
    const cutoff = dateCutoff(dateRange)

    const [tapRes, profRes] = await Promise.all([
      supabase
        .from('door_taps')
        .select('id, lat, lng, outcome, tapped_at, address, note, session_id')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .gte('tapped_at', cutoff)
        .order('tapped_at', { ascending: false })
        .limit(2000),
      supabase.from('profiles').select('id, display_name, color'),
    ])

    const pMap = {}
    ;(profRes.data ?? []).forEach(p => { pMap[p.id] = p })

    const rawTaps = tapRes.data ?? []
    setTapCount(rawTaps.length)

    let sessUserMap = {}
    const sessionIds = [...new Set(rawTaps.map(t => t.session_id).filter(Boolean))]
    if (sessionIds.length > 0) {
      try {
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, user_id')
          .in('id', sessionIds.slice(0, 200))
        ;(sessions ?? []).forEach(s => { if (s.user_id) sessUserMap[s.id] = s.user_id })
      } catch (_) {}
    }

    const enriched = rawTaps.map(t => ({
      ...t,
      userId: t.session_id ? (sessUserMap[t.session_id] ?? null) : null,
    }))

    setProfileMap(pMap)
    setTaps(enriched)
    setAllRepIds([...new Set(enriched.map(t => t.userId).filter(Boolean))])
    setLoading(false)
  }, [dateRange])

  useEffect(() => { load() }, [load])

  // Rebuild markers when data or filters change
  useEffect(() => {
    const map = mapRef.current
    if (!map || loading) return

    if (layerRef.current) {
      try { map.removeLayer(layerRef.current) } catch (_) {}
    }

    const layer = makeLayerGroup()

    const filtered = taps.filter(t =>
      !hiddenOutcomes.has(t.outcome) &&
      !(hiddenReps.size > 0 && t.userId && hiddenReps.has(t.userId))
    )

    const bounds = []
    filtered.forEach(tap => {
      if (tap.lat == null || tap.lng == null) return
      const icon = tap.outcome === 'nie_wieder' ? nieWiederIcon() : dotIcon(OUTCOME_COLORS[tap.outcome] ?? '#9CA3AF')
      const marker = L.marker([tap.lat, tap.lng], { icon })
      const repName = tap.userId ? (profileMap[tap.userId]?.display_name ?? null) : null
      marker.bindPopup(buildPopupHtml(tap, repName), { maxWidth: 240 })
      layer.addLayer(marker)
      bounds.push([tap.lat, tap.lng])
    })

    map.addLayer(layer)
    layerRef.current = layer

    if (bounds.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 15, animate: false })
      } catch (_) {}
    }
  }, [taps, hiddenOutcomes, hiddenReps, profileMap, loading])

  const toggleOutcome = (o) => setHiddenOutcomes(prev => {
    const n = new Set(prev); n.has(o) ? n.delete(o) : n.add(o); return n
  })
  const toggleRep = (id) => setHiddenReps(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const presentOutcomes = [...new Set(taps.map(t => t.outcome))].filter(o => o in OUTCOME_COLORS)

  const statusLabel = loading
    ? 'Laden…'
    : tapCount === 0
    ? 'Keine GPS-Daten'
    : `${tapCount} Türen`

  return (
    <div className={embedded ? 'flex flex-col h-full' : 'fixed inset-0 z-50 flex flex-col bg-white'}>
      {!embedded && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white shadow-sm shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 font-bold text-lg pressable"
          >
            ←
          </button>
          <h2 className="text-base font-bold text-gray-900">Karte</h2>
          <span className="ml-auto text-xs text-gray-400">{statusLabel}</span>
        </div>
      )}

      {/* Map + floating "Zu mir" button */}
      <div className="relative" style={{ flex: 1, minHeight: 0 }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        {hasUserLocation && (
          <button
            onClick={centerOnUser}
            className="pressable absolute z-[1000] right-4 bottom-4 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center"
            style={{ width: 44, height: 44 }}
            aria-label="Zu meinem Standort"
          >
            <span className="text-blue-500 text-lg leading-none">◎</span>
          </button>
        )}
      </div>

      {/* Filter strip — safe-area aware */}
      <div
        className="bg-white border-t border-gray-100 shrink-0"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <div
          className="flex gap-1.5 items-center px-3 pt-2.5 pb-1 overflow-x-auto"
          style={{ scrollbarWidth: 'none', width: 'max-content', maxWidth: '100%' }}
        >
          {[['7d', '7 Tage'], ['30d', '30 Tage'], ['all', 'Alles']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setDateRange(id)}
              className="px-3 rounded-full text-xs font-semibold pressable flex-shrink-0"
              style={{
                minHeight: 44,
                ...(dateRange === id ? { background: '#F59E0B', color: '#fff' } : { background: '#F3F4F6', color: '#6B7280' })
              }}
            >
              {label}
            </button>
          ))}

          {presentOutcomes.length > 0 && <div className="w-px h-4 bg-gray-200 mx-0.5 shrink-0" />}

          {presentOutcomes.map(outcome => {
            const color = OUTCOME_COLORS[outcome]
            const hidden = hiddenOutcomes.has(outcome)
            return (
              <button
                key={outcome}
                onClick={() => toggleOutcome(outcome)}
                className="flex items-center gap-1 px-2.5 rounded-full text-xs font-semibold pressable flex-shrink-0"
                style={{
                  minHeight: 44,
                  ...(hidden ? { background: '#F3F4F6', color: '#9CA3AF' } : { background: color + '25', color })
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hidden ? '#D1D5DB' : color }} />
                {OUTCOME_LABELS[outcome]}
              </button>
            )
          })}

          {allRepIds.length > 1 && (
            <>
              <div className="w-px h-4 bg-gray-200 mx-0.5 shrink-0" />
              {allRepIds.map(id => {
                const rep = profileMap[id]
                if (!rep) return null
                const color = rep.color ?? '#F59E0B'
                const hidden = hiddenReps.has(id)
                return (
                  <button
                    key={id}
                    onClick={() => toggleRep(id)}
                    className="px-2.5 rounded-full text-xs font-semibold pressable flex-shrink-0"
                    style={{
                      minHeight: 44,
                      ...(hidden ? { background: '#F3F4F6', color: '#9CA3AF' } : { background: color + '25', color })
                    }}
                  >
                    {rep.display_name}
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
