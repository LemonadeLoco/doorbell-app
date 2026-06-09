import { supabase } from '../lib/supabase'
import { reverseGeocode } from '../lib/geocode'
import { OFFLINE_TAPS_KEY } from '../lib/constants'

export function useGPS() {
  const saveTap = (sessionId, outcome, lat = null, lng = null, address = null, contactId = null) => {
    const tap = {
      session_id: sessionId,
      lat, lng, address,
      contact_id: contactId,
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

  const captureAndSave = (sessionId, outcome, contactId = null) => {
    if (!navigator.geolocation) { saveTap(sessionId, outcome, null, null, null, contactId); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const address = await reverseGeocode(lat, lng)
        saveTap(sessionId, outcome, lat, lng, address, contactId)
      },
      () => saveTap(sessionId, outcome, null, null, null, contactId),
      { timeout: 5000, maximumAge: 30000 }
    )
  }

  // Returns { lat, lng, address } or null — for pre-filling forms
  const getPosition = () => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const address = await reverseGeocode(lat, lng)
        resolve({ lat, lng, address })
      },
      () => resolve(null),
      { timeout: 5000, maximumAge: 30000 }
    )
  })

  return { captureAndSave, getPosition }
}
