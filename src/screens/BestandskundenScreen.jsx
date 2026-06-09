import { useState } from 'react'
import { useContacts } from '../hooks/useContacts'
import { PRODUCTS } from '../lib/constants'
import { Toast, useToast } from '../components/Toast'

export function BestandskundenScreen({ onBack }) {
  const [lastProduct, setLastProduct] = useState('')
  const [count, setCount]     = useState(0)
  const [form, setForm]       = useState(emptyForm())
  const { addContact }        = useContacts()
  const { toast, show }       = useToast()

  function emptyForm(product = '') {
    return { nachname: '', vorname: '', phone: '', address: '', product, kaufjahr: '', notes: '' }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nachname.trim()) return
    const name = [form.vorname.trim(), form.nachname.trim()].filter(Boolean).join(' ')
    await addContact({
      name,
      phone:   form.phone.trim()   || null,
      address: form.address.trim() || null,
      product: form.product        || null,
      notes:   [form.kaufjahr ? `Kaufjahr: ${form.kaufjahr}` : '', form.notes.trim()].filter(Boolean).join('\n') || null,
      source:  'anruf',
      status:  'anrufen',
    })
    const nextProduct = form.product || lastProduct
    setLastProduct(nextProduct)
    setCount(c => c + 1)
    setForm(emptyForm(nextProduct))
    show(`✓ ${name} hinzugefügt`)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-5 pb-4 shadow-sm sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-amber-500 font-semibold text-sm mb-3">
          ← Pipeline
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-gray-900">Bestandskunden</h1>
          {count > 0 && (
            <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
              {count} heute
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">Nach jedem Speichern wird das Formular zurückgesetzt — Produkt bleibt.</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nachname *</span>
              <input autoFocus type="text" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-purple-400"
                value={form.nachname} onChange={e => set('nachname', e.target.value)} placeholder="Mustermann" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vorname</span>
              <input type="text" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-purple-400"
                value={form.vorname} onChange={e => set('vorname', e.target.value)} placeholder="Max" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefon</span>
            <input type="tel" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-purple-400"
              value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+49 ..." />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Adresse</span>
            <input type="text" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-purple-400"
              value={form.address} onChange={e => set('address', e.target.value)} placeholder="Musterstr. 1, 12345 Stadt" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produkt (gekauft)</span>
            <select className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:border-purple-400"
              value={form.product} onChange={e => set('product', e.target.value)}>
              <option value="">— wählen —</option>
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kaufjahr</span>
              <input type="text" inputMode="numeric" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-purple-400"
                value={form.kaufjahr} onChange={e => set('kaufjahr', e.target.value)} placeholder="2021" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notiz</span>
            <textarea rows={2} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-purple-400 resize-none"
              value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional..." />
          </label>

          <button
            className="btn-press w-full py-4 rounded-2xl font-bold text-white text-base"
            style={{ background: '#8B5CF6' }}
            onClick={handleSave}
          >
            Speichern + Nächster
          </button>
        </div>

        <button
          className="btn-press w-full py-3 text-gray-500 text-sm font-medium text-center"
          onClick={onBack}
        >
          Fertig ({count} hinzugefügt)
        </button>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
