import { useState, useEffect, useRef } from 'react'
import { PRODUCTS } from '../lib/constants'

export function ContactSheet({ mode, onSave, onClose, getPosition, initialAddress = '' }) {
  const isTermin       = mode === 'termin'
  const isWiedervorlage = mode === 'wiedervorlage'
  const [form, setForm]       = useState({ name: '', phone: '', address: initialAddress, apartment: '', product: '', notes: '', appt_at: '', followup_at: '' })
  const [geoLoading, setGeoLoading] = useState(false)
  const sheetRef = useRef(null)
  const startY   = useRef(0)
  const dragY    = useRef(0)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    document.body.classList.add('sheet-open')
    return () => document.body.classList.remove('sheet-open')
  }, [])

  useEffect(() => {
    if (!getPosition || initialAddress) return
    setGeoLoading(true)
    getPosition().then(pos => {
      if (pos?.address) set('address', pos.address)
      setGeoLoading(false)
    }).catch(() => setGeoLoading(false))
  }, [])

  const onTouchStart = (e) => { startY.current = e.touches[0].clientY }
  const onTouchMove  = (e) => {
    const diff = e.touches[0].clientY - startY.current
    dragY.current = diff
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`
      sheetRef.current.style.transition = 'none'
    }
  }
  const onTouchEnd = () => {
    if (dragY.current > 80) { onClose() }
    else if (sheetRef.current) {
      sheetRef.current.style.transform = ''
      sheetRef.current.style.transition = 'transform 0.2s ease-out'
    }
    dragY.current = 0
  }

  const handleSave = () => {
    if (!isWiedervorlage && !form.name.trim()) return
    onSave({
      name:        form.name.trim() || 'Unbekannt',
      phone:       form.phone.trim()     || null,
      address:     form.address.trim()   || null,
      apartment:   form.apartment.trim() || null,
      product:     form.product          || null,
      notes:       form.notes.trim()     || null,
      appt_at:     isTermin && form.appt_at ? new Date(form.appt_at).toISOString() : null,
      followup_at: isWiedervorlage && form.followup_at ? new Date(form.followup_at).toISOString() : null,
      status:      isTermin ? 'termin' : isWiedervorlage ? 'wiedervorlage' : 'anrufen',
    })
  }

  const btnColor = isTermin ? '#10B981' : isWiedervorlage ? '#3B82F6' : '#F59E0B'
  const title    = isTermin ? 'Termin notieren' : isWiedervorlage ? 'Wiedervorlage' : 'Kontakt notieren'

  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet-enter w-full bg-white rounded-t-2xl shadow-2xl p-5 pb-8 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pb-3 -mt-1 cursor-grab"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <h2 className="text-base font-bold text-gray-900 mb-4">{title}</h2>

        {!isWiedervorlage && (
          <>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name *</span>
              <input autoFocus type="text" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
                value={form.name} onChange={e => set('name', e.target.value)} placeholder="Max Mustermann" />
            </label>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefon</span>
              <input type="tel" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
                value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+49 ..." />
            </label>
          </>
        )}

        <label className="block mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Adresse {geoLoading && <span className="normal-case text-amber-400 ml-1">📍 lädt...</span>}
          </span>
          <input type="text" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
            value={form.address} onChange={e => set('address', e.target.value)} placeholder="Straße, PLZ Ort" />
        </label>

        {form.address && (
          <label className="block mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wohnungsnummer</span>
            <input type="text" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={form.apartment} onChange={e => set('apartment', e.target.value)} placeholder="z.B. 3. OG links" />
          </label>
        )}

        {!isWiedervorlage && (
          <label className="block mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produkt</span>
            <select className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400 bg-white"
              value={form.product} onChange={e => set('product', e.target.value)}>
              <option value="">— wählen —</option>
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}

        {isTermin && (
          <label className="block mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum &amp; Uhrzeit</span>
            <input type="datetime-local" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={form.appt_at} onChange={e => set('appt_at', e.target.value)} />
          </label>
        )}

        {isWiedervorlage && (
          <label className="block mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wiedervorlage am (optional)</span>
            <input type="date" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={form.followup_at} onChange={e => set('followup_at', e.target.value)} />
          </label>
        )}

        <label className="block mb-5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notiz</span>
          <textarea rows={2} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400 resize-none"
            value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional..." />
        </label>

        <button className="pressable w-full py-4 rounded-2xl font-bold text-white text-base" style={{ background: btnColor }} onClick={handleSave}>
          {isTermin ? 'Termin speichern' : isWiedervorlage ? 'Wiedervorlage speichern' : 'Kontakt speichern'}
        </button>
      </div>
    </div>
  )
}
