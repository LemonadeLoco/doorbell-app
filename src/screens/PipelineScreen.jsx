import { useState, useMemo } from 'react'
import { useContacts } from '../hooks/useContacts'
import { StatusBadge, SourceBadge } from '../components/StatusBadge'
import { PRODUCTS, formatDateSmart } from '../lib/constants'

const FILTERS = [
  { id: 'Alle',           label: 'Alle' },
  { id: 'anrufen',        label: 'Anrufen' },
  { id: 'termin',         label: 'Termine' },
  { id: 'kontakt',        label: 'Kontakte' },
  { id: 'verkauft',       label: 'Verkauft' },
  { id: 'wiedervorlage',  label: 'Wiedervorlage' },
  { id: 'bestandskunden', label: 'Bestandskunden' },
  { id: 'archiv',         label: 'Archiv' },
]

export function PipelineScreen({ onContactSelect, onAddBestandskunde }) {
  const [filter, setFilter]   = useState('Alle')
  const [search, setSearch]   = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const { contacts, loading, addContact } = useContacts()

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      let ok = true
      if (filter === 'bestandskunden') ok = c.source === 'anruf'
      else if (filter !== 'Alle')      ok = c.status === filter
      const q = search.toLowerCase()
      return ok && (!q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.product?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q))
    })
  }, [contacts, filter, search])

  const sorted = useMemo(() => {
    if (filter !== 'bestandskunden') return filtered
    const order = { anrufen: 0, kontakt: 1, termin: 2, verkauft: 3, kein_int: 4, archiv: 5 }
    return [...filtered].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
  }, [filtered, filter])

  const initials   = (name) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const avatarColor = (name) => {
    const colors = ['#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#EF4444']
    return colors[(name?.charCodeAt(0) ?? 0) % colors.length]
  }

  const isBK = filter === 'bestandskunden'

  return (
    <div className="flex flex-col min-h-screen pb-28">
      <div className="bg-white px-4 pt-5 pb-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-extrabold text-gray-900">Pipeline</h1>
          {isBK && (
            <button onClick={onAddBestandskunde} className="pressable px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-xl">
              + Bestandskunden
            </button>
          )}
        </div>
        <input type="search" className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white border-b border-gray-100">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="pressable flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={filter === f.id
              ? { background: f.id === 'bestandskunden' ? '#8B5CF6' : '#F59E0B', color: '#fff' }
              : { background: '#F3F4F6', color: '#6B7280' }
            }>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-3 flex flex-col gap-2">
        {loading ? (
          <p className="text-center text-gray-400 mt-10 text-sm">Laden...</p>
        ) : sorted.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500 font-semibold text-sm">Noch keine Kontakte</p>
            {isBK
              ? <button className="mt-4 px-5 py-2.5 bg-purple-500 text-white text-sm font-bold rounded-xl pressable" onClick={onAddBestandskunde}>+ Bestandskunden hinzufügen</button>
              : <button className="mt-4 px-5 py-2.5 bg-amber-400 text-white text-sm font-bold rounded-xl pressable" onClick={() => setShowAdd(true)}>+ Kontakt hinzufügen</button>
            }
          </div>
        ) : (
          sorted.map(c => (
            <ContactCard key={c.id} contact={c} onSelect={() => onContactSelect(c)}
              showQuickDial={isBK} initials={initials} avatarColor={avatarColor} />
          ))
        )}
      </div>

      <button onClick={() => setShowAdd(true)}
        className="pressable fixed bottom-24 right-5 w-14 h-14 rounded-full bg-amber-400 text-white text-2xl font-bold shadow-xl flex items-center justify-center z-20">
        +
      </button>

      {showAdd && (
        <AddContactModal onClose={() => setShowAdd(false)} onSave={async (data) => { await addContact(data); setShowAdd(false) }} />
      )}
    </div>
  )
}

function ContactCard({ contact: c, onSelect, showQuickDial, initials, avatarColor }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <button className="pressable flex items-center gap-3 w-full text-left" onClick={onSelect}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: avatarColor(c.name) }}>
          {initials(c.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">{c.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <SourceBadge source={c.source} />
            {c.product && <span className="text-xs text-gray-400">{c.product}</span>}
          </div>
          <p className="text-xs text-gray-300 mt-0.5">
            {c.source === 'anruf' ? formatDateSmart(c.added_at) : new Date(c.added_at).toLocaleDateString('de-DE')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <StatusBadge status={c.status} />
          <span className="text-gray-300 text-base">›</span>
        </div>
      </button>
      {showQuickDial && c.phone && (
        <a href={`tel:${c.phone.replace(/\s/g,'')}`}
          className="pressable flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-semibold"
          onClick={e => e.stopPropagation()}>
          📞 Anrufen
        </a>
      )}
    </div>
  )
}

function AddContactModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', product: '', source: 'tür', notes: '', status: 'anrufen' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="sheet-enter w-full bg-white rounded-t-2xl shadow-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-4" />
        <h2 className="text-base font-bold text-gray-900 mb-4">Kontakt hinzufügen</h2>
        {[
          { label: 'Name *',  key: 'name',    type: 'text', placeholder: 'Max Mustermann' },
          { label: 'Telefon', key: 'phone',   type: 'tel',  placeholder: '+49 ...' },
          { label: 'Adresse', key: 'address', type: 'text', placeholder: 'Musterstr. 1, 12345 Stadt' },
        ].map(f => (
          <label key={f.key} className="block mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</span>
            <input type={f.type} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
          </label>
        ))}
        <label className="block mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produkt</span>
          <select className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none"
            value={form.product} onChange={e => set('product', e.target.value)}>
            <option value="">— wählen —</option>
            {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quelle</span>
          <select className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none"
            value={form.source} onChange={e => set('source', e.target.value)}>
            <option value="tür">Haustür-Kontakt</option>
            <option value="anruf">Bestandskunde</option>
          </select>
        </label>
        <label className="block mb-5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notiz</span>
          <textarea rows={2} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none resize-none"
            value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional..." />
        </label>
        <button className="pressable w-full py-4 rounded-2xl font-bold text-white text-base bg-amber-400"
          onClick={() => { if (form.name.trim()) onSave({ ...form, name: form.name.trim() }) }}>
          Speichern
        </button>
      </div>
    </div>
  )
}
