import { supabase } from '../lib/supabase'
import { OFFLINE_TAPS_KEY } from '../lib/constants'

export function useGPS() {
  const saveTap = (sessionId, outcome, lat = null, lng = null) => {
    const tap = {
      session_id: sessionId,
      lat,
      lng,
      outcome,
      tapped_at: new Date().toISOString(),
    }
    supabase.from('door_taps').insert(tap).then(({ error }) => {
      if (error) queueOffline(tap)
    })
  }

  const queueOffline = (tap) => {
    try {
      const raw = localStorage.getItem(OFFLINE_TAPS_KEY)
      const taps = raw ? JSON.parse(raw) : []
      taps.push(tap)
      localStorage.setItem(OFFLINE_TAPS_KEY, JSON.stringify(taps))
    } catch {}
  }

  const captureAndSave = (sessionId, outcome) => {
    if (!navigator.geolocation) {
      saveTap(sessionId, outcome)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => saveTap(sessionId, outcome, pos.coords.latitude, pos.coords.longitude),
      ()    => saveTap(sessionId, outcome),
      { timeout: 5000, maximumAge: 30000 }
    )
  }

  return { captureAndSave }
}
