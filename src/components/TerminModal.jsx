import { useState, useEffect } from 'react'

export const TERMIN_PRODUCTS = [
  'Rollläden', 'Fenster', 'Haustüren', 'Markisen',
  'Terrassendächer', 'Garagentore', 'Insektenschutz', 'Sonnenschutz',
]

export function ProductChips({ selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TERMIN_PRODUCTS.map(p => {
        const active = selected.includes(p)
        return (
          <button
            key={p}
            type="button"
            className="pressable px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={active
              ? { background: '#F59E0B', color: '#fff' }
              : { background: '#fff', color: '#6B7280', border: '1.5px solid #D1D5DB' }}
            onClick={() => onChange(active ? selected.filter(x => x !== p) : [...selected, p])}
          >
            {p}
          </button>
        )
      })}
    </div>
  )
}

// Fields-only component — no sheet wrapper. Parent provides the surrounding UI.
export function TerminModal({ isOpen, onClose, onSave, prefillProducts = [] }) {
  const [products, setProducts] = useState([])
  const [apptAt, setApptAt]     = useState('')
  const [notes, setNotes]       = useState('')
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setProducts(prefillProducts.length ? [...prefillProducts] : [])
      setApptAt('')
      setNotes('')
      setAttempted(false)
    }
  }, [isOpen]) // eslint-disable-line

  if (!isOpen) return null

  const canSave = products.length > 0 && apptAt !== ''

  const handleSave = () => {
    setAttempted(true)
    if (!canSave) return
    onSave({ apptAt, products, notes })
  }

  return (
    <>
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Produkt *</p>
        <ProductChips selected={products} onChange={setProducts} />
        {attempted && products.length === 0 && (
          <p className="text-xs text-red-500 mt-1.5">Bitte wähle mindestens ein Produkt</p>
        )}
      </div>
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Datum &amp; Uhrzeit *</p>
        <input
          type="datetime-local"
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
          value={apptAt}
          onChange={e => setApptAt(e.target.value)}
        />
      </div>
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notiz</p>
        <textarea
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400 resize-none"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional..."
        />
      </div>
      <button
        className="pressable w-full py-4 rounded-2xl font-bold text-white bg-amber-400 disabled:opacity-50"
        onClick={handleSave}
      >
        Speichern
      </button>
    </>
  )
}
