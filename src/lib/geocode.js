// Reverse geocode via Nominatim. Returns address string or null. Never throws.
export async function reverseGeocode(lat, lng) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { signal: controller.signal, headers: { 'Accept-Language': 'de' } }
    )
    clearTimeout(timer)
    const d = await res.json()
    const a = d.address ?? {}
    const street = [a.road, a.house_number].filter(Boolean).join(' ')
    const city   = a.city || a.town || a.village || ''
    const parts  = [street, a.postcode, city].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  } catch {
    return null
  }
}
