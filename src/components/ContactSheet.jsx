import { useState, useEffect } from 'react'
import { PRODUCTS } from '../lib/constants'

export function ContactSheet({ mode, onSave, onClose, getPosition }) {
  const isTermin = mode === 'termin'
  const [form, setForm] = useState({ name: '', phone: '', address: '', product: '', notes: '', appt_at: '' })
  const [geoLoading, setGeoLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!getPosition) return
    setGeoLoading(true)
    getPosition().then(pos => {
      if (pos?.address) set('address', pos.address)
      setGeoLoading(false)
    }).catch(() => setGeoLoading(false))
  }, [])

  const handleSave = () => {
    if (!form.name.trim()) return
    onSave({
      name:    form.name.trim(),
      phone:   form.phone.trim()   || null,
      address: form.address.trim() || null,
      product: form.product        || null,
      notes:   form.notes.trim()   || null,
      appt_at: isTermin && form.appt_at ? new Date(form.appt_at).toISOString() : null,
      status:  isTermin ? 'termin' : 'anrufen',
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div
        className="sheet-enter w-full bg-white rounded-t-2xl shadow-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-4" />
        <h2 className="text-base font-bold text-gray-900 mb-4">
          {isTermin ? 'Termin notieren' : 'Kontakt notieren'}
        </h2>

        {[
          { label: 'Name *', key: 'name', type: 'text', placeholder: 'Max Mustermann', autoFocus: true },
          { label: 'Telefon', key: 'phone', type: 'tel', placeholder: '+49 ...' },
        ].map(f => (
          <label key={f.key} className="block mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</span>
            <input
              autoFocus={f.autoFocus}
              type={f.type}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          </label>
        ))}

        <label className="block mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Adresse {geoLoading && <span className="normal-case text-amber-400 ml-1">📍 lädt...</span>}
          </span>
          <input
            type="text"
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
            value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="Straße, PLZ Ort"
          />
        </label>

        <label className="block mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produkt</span>
          <select
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400 bg-white"
            value={form.product} onChange={e => set('product', e.target.value)}
          >
            <option value="">— wählen —</option>
            {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>

        {isTermin && (
          <label className="block mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum & Uhrzeit</span>
            <input
              type="datetime-local"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={form.appt_at} onChange={e => set('appt_at', e.target.value)}
            />
          </label>
        )}

        <label className="block mb-5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notiz</span>
          <textarea
            rows={2}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400 resize-none"
            value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Optional..."
          />
        </label>

        <button
          className="btn-press w-full py-4 rounded-2xl font-bold text-white text-base"
          style={{ background: isTermin ? '#10B981' : '#F59E0B' }}
          onClick={handleSave}
        >
          {isTermin ? 'Termin speichern' : 'Kontakt speichern'}
        </button>
      </div>
    </div>
  )
}
