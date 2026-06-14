import { useState, useMemo, useRef } from 'react'
import { useContacts } from '../hooks/useContacts'
import { usePipelineGroups } from '../hooks/usePipelineGroups'
import { StatusBadge, SourceBadge } from '../components/StatusBadge'
import { PRODUCTS, formatDateSmart } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { BottomSheet } from '../components/BottomSheet'
import { CallOutcomeOverlay } from '../components/CallOutcomeOverlay'

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

const STATUS_LABELS = {
  anrufen:      'Zum Anrufen',
  kontakt:      'Kontakt',
  termin:       'Termin',
  verkauft:     'Verkauft',
  wiedervorlage:'Wiedervorlage',
  kein_int:     'Kein Interesse',
  archiv:       'Archiv',
}

const STATUS_COLORS = {
  anrufen:      '#3B82F6',
  kontakt:      '#F59E0B',
  termin:       '#10B981',
  verkauft:     '#8B5CF6',
  wiedervorlage:'#6366F1',
  kein_int:     '#EF4444',
  archiv:       '#9CA3AF',
}

function relativeTime(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2)   return 'Gerade eben'
  if (mins < 60)  return `Vor ${mins} Min.`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `Vor ${hrs} Std.`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Gestern'
  if (days < 7)   return `Vor ${days} Tagen`
  return formatDateSmart(iso)
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// ─── Admin salesman switcher ──────────────────────────────────────────────────
function AdminSwitcher({ salesmen, selectedId, onChange }) {
  if (!salesmen?.length) return null
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
      {salesmen.map(s => (
        <button
          key={s.id}
          className="pressable flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={selectedId === s.id
            ? { background: '#F59E0B', color: '#fff' }
            : { color: '#9CA3AF' }}
          onClick={() => onChange(s.id)}
        >
          {s.display_name}
        </button>
      ))}
    </div>
  )
}

export function PipelineScreen({ onContactSelect, onAddBestandskunde, onStartCallMode, isAdmin, salesmen, selectedSalesmanId, onSalesmanChange }) {
  const [filter, setFilter]       = useState('Alle')
  const [search, setSearch]       = useState('')
  const [showAdd, setShowAdd]         = useState(false)
  const [showImport, setShowImport]   = useState(false)
  const [showManualBK, setShowManualBK] = useState(false)
  const [compactView, setCompactView] = useState(false)
  const [showFABMenu, setShowFABMenu] = useState(false)
  const [showIntentChooser, setShowIntentChooser] = useState(false)
  const [intentStatus, setIntentStatus] = useState('anrufen')
  const [archivExpanded, setArchivExpanded] = useState(false)
  const [callOverlayContact, setCallOverlayContact] = useState(null)

  // When admin, filter contacts by selectedSalesmanId; regular users let RLS handle it
  const salesmanFilter = isAdmin ? selectedSalesmanId : null
  const { contacts, loading, addContact } = useContacts(null, salesmanFilter)

  const today    = todayStr()
  const tomorrow = tomorrowStr()

  const counts = useMemo(() => {
    const c = { Alle: 0, anrufen: 0, termin: 0, kontakt: 0, verkauft: 0, wiedervorlage: 0, bestandskunden: 0, archiv: 0 }
    contacts.forEach(ct => {
      if (ct.status !== 'kein_int') {
        if (ct.status !== 'archiv') c.Alle++
        c[ct.status] = (c[ct.status] ?? 0) + 1
        if (ct.source === 'anruf') c.bestandskunden++
      }
    })
    return c
  }, [contacts])

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      let ok = true
      if (filter === 'bestandskunden') ok = c.source === 'anruf'
      else if (filter === 'archiv')    ok = c.status === 'archiv' || c.status === 'kein_int'
      else if (filter === 'Alle')      ok = c.status !== 'archiv' && c.status !== 'kein_int'
      else                             ok = c.status === filter
      const q = search.toLowerCase()
      return ok && (!q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.product?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q))
    })
  }, [contacts, filter, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const score = (c) => {
        const apptDate = c.appt_at ? c.appt_at.split('T')[0] : null
        if (c.status === 'termin' && apptDate === today)    return 0
        if (c.status === 'termin' && apptDate === tomorrow) return 1
        if (c.status === 'anrufen')    return 2
        if (c.status === 'kontakt')    return 3
        if (c.status === 'wiedervorlage' && c.followup_at?.startsWith(today)) return 4
        if (c.status === 'wiedervorlage') return 5
        if (c.status === 'verkauft')   return 6
        return 7
      }
      const sa = score(a), sb = score(b)
      if (sa !== sb) return sa - sb
      if (a.status === 'termin' && b.status === 'termin') {
        return (a.appt_at ?? '').localeCompare(b.appt_at ?? '')
      }
      return (b.updated_at ?? b.added_at ?? '').localeCompare(a.updated_at ?? a.added_at ?? '')
    })
  }, [filtered, today, tomorrow])

  const initials    = (name) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const avatarColor = (name) => {
    const colors = ['#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#EF4444']
    return colors[(name?.charCodeAt(0) ?? 0) % colors.length]
  }

  const { urgent, active, archived } = usePipelineGroups(contacts)
  const isSectioned = filter === 'Alle' && !search.trim()
  const isBK = filter === 'bestandskunden'

  const isExpired = (c) => {
    if (c.status !== 'termin' || !c.appt_at) return false
    return Date.now() - new Date(c.appt_at).getTime() > 2 * 3600000
  }

  return (
    <div className="flex flex-col min-h-screen pb-28">
      <div className="bg-white px-4 pt-5 pb-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-extrabold text-gray-900">Pipeline</h1>
          <div className="flex items-center gap-2">
            <button
              className="pressable w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-sm"
              onClick={() => setCompactView(v => !v)}
              title={compactView ? 'Kartenansicht' : 'Listenansicht'}
            >
              {compactView ? '⊞' : '☰'}
            </button>
            {isBK && (
              <button onClick={onAddBestandskunde} className="pressable px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-xl">
                + Bestandskunden
              </button>
            )}
          </div>
        </div>

        {/* Admin salesman switcher */}
        {isAdmin && salesmen.length > 0 && (
          <div className="mb-3">
            <AdminSwitcher salesmen={salesmen} selectedId={selectedSalesmanId} onChange={onSalesmanChange} />
          </div>
        )}

        <input type="search" className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filter pills */}
      <div className="relative bg-white border-b border-gray-100">
        <div
          className="flex gap-2 px-4 py-3 overflow-x-auto"
          style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
        >
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="pressable flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                scrollSnapAlign: 'start',
                ...(filter === f.id
                  ? { background: f.id === 'bestandskunden' ? '#8B5CF6' : '#F59E0B', color: '#fff' }
                  : { background: '#F3F4F6', color: '#6B7280' })
              }}>
              {f.label}{counts[f.id] != null ? ` (${counts[f.id]})` : ''}
            </button>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none" style={{ background: 'linear-gradient(to right, transparent, white)' }} />
      </div>

      <div className="flex-1 px-4 py-3 flex flex-col gap-2">
        {/* Anruf-Modus entry */}
        {onStartCallMode && (
          <button
            onClick={onStartCallMode}
            className="pressable flex items-center gap-3 bg-blue-500 text-white rounded-2xl px-4 py-3 shadow-sm mb-1"
          >
            <span className="text-xl flex-shrink-0">📞</span>
            <div className="flex-1 text-left">
              <p className="font-bold text-sm">Anruf-Modus starten</p>
              <p className="text-xs opacity-75">Bestandskunden systematisch abarbeiten</p>
            </div>
            <span className="text-lg opacity-60">›</span>
          </button>
        )}
        {loading ? (
          <p className="text-center text-gray-400 mt-10 text-sm">Laden...</p>
        ) : isSectioned ? (
          <>
            {urgent.length === 0 && active.length === 0 && archived.length === 0 ? (
              <div className="text-center mt-16">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-500 font-semibold text-sm">Keine Kontakte vorhanden</p>
                <button className="mt-4 px-5 py-2.5 bg-amber-400 text-white text-sm font-bold rounded-xl pressable" onClick={() => { setIntentStatus('anrufen'); setShowIntentChooser(true) }}>+ Kontakt hinzufügen</button>
              </div>
            ) : (
              <>
                {urgent.length > 0 && (
                  <>
                    <SectionHeader title="Handlungsbedarf" count={urgent.length} color="#F59E0B" />
                    {compactView
                      ? urgent.map(c => <CompactCard key={c.id} contact={c} onSelect={() => onContactSelect(c)} isExpired={isExpired(c)} today={today} onCallLog={c.phone ? () => setCallOverlayContact(c) : null} sectionType="urgent" />)
                      : urgent.map(c => <ContactCard key={c.id} contact={c} onSelect={() => onContactSelect(c)} showQuickDial={isBK} initials={initials} avatarColor={avatarColor} isExpired={isExpired(c)} today={today} tomorrow={tomorrow} onCallLog={c.phone ? () => setCallOverlayContact(c) : null} sectionType="urgent" />)
                    }
                  </>
                )}
                {active.length > 0 && (
                  <>
                    <SectionHeader title="In Bearbeitung" count={active.length} color="#3B82F6" />
                    {compactView
                      ? active.map(c => <CompactCard key={c.id} contact={c} onSelect={() => onContactSelect(c)} isExpired={isExpired(c)} today={today} onCallLog={c.phone ? () => setCallOverlayContact(c) : null} sectionType="active" />)
                      : active.map(c => <ContactCard key={c.id} contact={c} onSelect={() => onContactSelect(c)} showQuickDial={isBK} initials={initials} avatarColor={avatarColor} isExpired={isExpired(c)} today={today} tomorrow={tomorrow} onCallLog={c.phone ? () => setCallOverlayContact(c) : null} sectionType="active" />)
                    }
                  </>
                )}
                {archived.length > 0 && (
                  <>
                    <button
                      className="pressable flex items-center justify-between w-full px-3 py-2.5 mt-1 rounded-xl bg-gray-50 text-gray-400 text-xs font-semibold"
                      onClick={() => setArchivExpanded(v => !v)}
                    >
                      <span>Kein Interesse / Archiv ({archived.length})</span>
                      <span>{archivExpanded ? '▲' : '▼'}</span>
                    </button>
                    {archivExpanded && (compactView
                      ? archived.map(c => <CompactCard key={c.id} contact={c} onSelect={() => onContactSelect(c)} isExpired={isExpired(c)} today={today} onCallLog={c.phone ? () => setCallOverlayContact(c) : null} sectionType="archived" />)
                      : archived.map(c => <ContactCard key={c.id} contact={c} onSelect={() => onContactSelect(c)} showQuickDial={false} initials={initials} avatarColor={avatarColor} isExpired={isExpired(c)} today={today} tomorrow={tomorrow} onCallLog={c.phone ? () => setCallOverlayContact(c) : null} sectionType="archived" />)
                    )}
                  </>
                )}
              </>
            )}
          </>
        ) : sorted.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500 font-semibold text-sm">Keine Kontakte vorhanden</p>
            {isBK
              ? <button className="mt-4 px-5 py-2.5 bg-purple-500 text-white text-sm font-bold rounded-xl pressable" onClick={onAddBestandskunde}>+ Bestandskunden hinzufügen</button>
              : <button className="mt-4 px-5 py-2.5 bg-amber-400 text-white text-sm font-bold rounded-xl pressable" onClick={() => { setIntentStatus('anrufen'); setShowIntentChooser(true) }}>+ Kontakt hinzufügen</button>
            }
          </div>
        ) : compactView ? (
          sorted.map(c => (
            <CompactCard key={c.id} contact={c} onSelect={() => onContactSelect(c)}
              isExpired={isExpired(c)} today={today}
              onCallLog={c.phone ? () => setCallOverlayContact(c) : null} />
          ))
        ) : (
          sorted.map(c => (
            <ContactCard key={c.id} contact={c} onSelect={() => onContactSelect(c)}
              showQuickDial={isBK} initials={initials} avatarColor={avatarColor}
              isExpired={isExpired(c)} today={today} tomorrow={tomorrow}
              onCallLog={c.phone ? () => setCallOverlayContact(c) : null} />
          ))
        )}
      </div>

      {/* FAB with menu */}
      <div className="fixed bottom-24 right-5 z-20 flex flex-col items-end gap-2">
        {showFABMenu && (
          <>
            <button
              className="pressable flex items-center gap-2 bg-white rounded-2xl px-4 py-3 shadow-lg text-sm font-semibold text-gray-700"
              onClick={() => { setShowFABMenu(false); setShowImport(true) }}
            >
              📄 PDF-Verträge importieren
            </button>
            <button
              className="pressable flex items-center gap-2 bg-white rounded-2xl px-4 py-3 shadow-lg text-sm font-semibold text-gray-700"
              onClick={() => { setShowFABMenu(false); setShowManualBK(true) }}
            >
              🏠 Bestandskunde eingeben
            </button>
            <button
              className="pressable flex items-center gap-2 bg-white rounded-2xl px-4 py-3 shadow-lg text-sm font-semibold text-gray-700"
              onClick={() => { setShowFABMenu(false); setShowIntentChooser(true) }}
            >
              ✏️ Kontakt manuell hinzufügen
            </button>
          </>
        )}
        <button
          onClick={() => setShowFABMenu(v => !v)}
          className="pressable w-14 h-14 rounded-full bg-amber-400 text-white text-2xl font-bold shadow-xl flex items-center justify-center"
        >
          {showFABMenu ? '✕' : '+'}
        </button>
      </div>

      {/* Intent chooser — appears before AddContactModal */}
      {showIntentChooser && (
        <IntentChooser
          onClose={() => setShowIntentChooser(false)}
          onSelect={(status) => {
            setIntentStatus(status)
            setShowIntentChooser(false)
            setShowAdd(true)
          }}
        />
      )}

      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          initialStatus={intentStatus}
          onSave={async (data) => {
            await addContact(data)
            setShowAdd(false)
          }}
        />
      )}

      {showImport && (
        <PdfImportFlow
          contacts={contacts}
          onClose={() => setShowImport(false)}
          onImported={() => setShowImport(false)}
          isAdmin={isAdmin}
          salesmen={salesmen}
          defaultSalesmanId={selectedSalesmanId}
        />
      )}

      {showManualBK && (
        <ManualBestandskundeForm
          onClose={() => setShowManualBK(false)}
          isAdmin={isAdmin}
          salesmen={salesmen}
          defaultSalesmanId={selectedSalesmanId}
        />
      )}

      {callOverlayContact && (
        <CallOutcomeOverlay
          contact={callOverlayContact}
          onClose={() => setCallOverlayContact(null)}
        />
      )}
    </div>
  )
}

// Intent chooser action sheet
function IntentChooser({ onSelect, onClose }) {
  const options = [
    { icon: '🔎', label: 'Interessent / Lead',       desc: 'Potenzielle Neukundschaft',    status: 'anrufen' },
    { icon: '🤝', label: 'Kontakt aufgenommen',       desc: 'Gespräch oder Kontakt notiert', status: 'kontakt' },
    { icon: '📅', label: 'Termin vereinbart',         desc: 'Fixer Beratungstermin',         status: 'termin' },
  ]
  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div
        className="sheet-enter w-full bg-white rounded-t-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center pb-3 pt-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 pb-3">
          Neuen Eintrag erstellen
        </p>
        {options.map(opt => (
          <button
            key={opt.status}
            className="pressable flex items-center gap-4 w-full px-5 py-4 border-b border-gray-50 last:border-0"
            onClick={() => onSelect(opt.status)}
          >
            <span className="text-2xl w-8 text-center flex-shrink-0">{opt.icon}</span>
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-900 text-sm">{opt.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </button>
        ))}
        <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }} />
      </div>
    </div>
  )
}

// Compact list-view card
function CompactCard({ contact: c, onSelect, isExpired, today, onCallLog, sectionType }) {
  const apptDate = c.appt_at ? c.appt_at.split('T')[0] : null
  const isToday  = apptDate === today
  const isWVOverdue = c.status === 'wiedervorlage' && (!c.followup_at || c.followup_at.split('T')[0] <= today)

  const borderColor = sectionType === 'urgent'   ? '#F59E0B'
                    : sectionType === 'active'    ? '#3B82F6'
                    : sectionType === 'archived'  ? '#9CA3AF'
                    : isExpired                   ? '#F59E0B'
                    : undefined

  return (
    <div
      className="flex items-center bg-white rounded-xl shadow-sm overflow-hidden"
      style={borderColor ? { borderLeft: `3px solid ${borderColor}`, opacity: sectionType === 'archived' ? 0.6 : 1 } : {}}
    >
      <button
        className="pressable flex items-center gap-3 flex-1 px-4 py-2.5 text-left min-w-0"
        onClick={onSelect}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isExpired && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Abgelaufen</span>}
          {isWVOverdue && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Fällig</span>}
          {c.status === 'termin' && isToday && c.appt_at && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
              {new Date(c.appt_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <StatusBadge status={c.status} />
          <span className="text-xs text-gray-300">{relativeTime(c.updated_at ?? c.added_at)}</span>
        </div>
      </button>
      {onCallLog && (
        <button
          className="pressable px-3 py-2.5 text-gray-400 text-sm flex-shrink-0 border-l border-gray-100"
          onClick={e => { e.stopPropagation(); onCallLog() }}
        >
          📞
        </button>
      )}
    </div>
  )
}

// Full card with swipe-to-call
function ContactCard({ contact: c, onSelect, showQuickDial, initials, avatarColor, isExpired, today, tomorrow, onCallLog, sectionType }) {
  const [swipeX, setSwipeX]     = useState(0)
  const [swiping, setSwiping]   = useState(false)
  const startXRef = useRef(0)
  const THRESHOLD = 60

  const apptDate = c.appt_at ? c.appt_at.split('T')[0] : null
  const isToday     = apptDate === today
  const isTomorrow  = apptDate === tomorrow
  const isWVOverdue = c.status === 'wiedervorlage' && (!c.followup_at || c.followup_at.split('T')[0] <= today)

  const borderColor = sectionType === 'urgent'   ? '#F59E0B'
                    : sectionType === 'active'    ? '#3B82F6'
                    : sectionType === 'archived'  ? '#9CA3AF'
                    : isExpired                   ? '#F59E0B'
                    : undefined

  const onTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX
    setSwiping(true)
  }
  const onTouchMove = (e) => {
    if (!swiping) return
    const dx = e.touches[0].clientX - startXRef.current
    if (dx > 0) setSwipeX(Math.min(dx, THRESHOLD + 20))
  }
  const onTouchEnd = () => {
    setSwiping(false)
    if (swipeX >= THRESHOLD && c.phone) {
      window.location.href = `tel:${c.phone.replace(/\s/g,'')}`
    }
    setSwipeX(0)
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={borderColor ? { borderLeft: `3px solid ${borderColor}`, opacity: sectionType === 'archived' ? 0.6 : 1 } : {}}
    >
      <div
        className="absolute left-0 top-0 bottom-0 flex items-center justify-center bg-green-500 text-white text-xs font-bold rounded-l-2xl"
        style={{ width: Math.max(0, swipeX), transition: swiping ? 'none' : 'width 0.2s ease-out' }}
      >
        {swipeX > 30 && '📞'}
      </div>

      <div
        className="bg-white rounded-2xl p-4 shadow-sm relative"
        style={{ transform: `translateX(${swipeX}px)`, transition: swiping ? 'none' : 'transform 0.2s ease-out' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
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
            <p className="text-xs text-gray-300 mt-0.5">{relativeTime(c.updated_at ?? c.added_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-xs">{c.source === 'anruf' ? '📞' : '🚪'}</span>
            {isExpired && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Abgelaufen</span>}
            {isWVOverdue && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Fällig</span>}
            {c.status === 'termin' && isToday && c.appt_at ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">
                {new Date(c.appt_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : c.status === 'termin' && isTomorrow ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Morgen</span>
            ) : c.status === 'verkauft' && !c.sale_amount ? (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">⚠️ Betrag fehlt</span>
            ) : (
              <StatusBadge status={c.status} />
            )}
            <span className="text-gray-300 text-base">›</span>
          </div>
        </button>
        {c.phone && (
          <div className="flex gap-2 mt-3">
            {showQuickDial && (
              <a
                href={`tel:${c.phone.replace(/\s/g,'')}`}
                className="pressable flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-semibold"
                onClick={e => e.stopPropagation()}
              >
                📞 Anrufen
              </a>
            )}
            {onCallLog && (
              <button
                className="pressable flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-gray-50 text-gray-500 text-xs font-semibold border border-gray-100"
                style={!showQuickDial ? { flex: 1 } : {}}
                onClick={e => { e.stopPropagation(); onCallLog() }}
              >
                📞 Anruf
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ title, count, color }) {
  return (
    <div className="flex items-center gap-2 mt-3 mb-1 px-1">
      <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</span>
      <span className="text-xs text-gray-400">({count})</span>
    </div>
  )
}

function AddContactModal({ onClose, onSave, initialStatus = 'anrufen' }) {
  const [form, setForm] = useState({
    name: '', phone: '', address: '', product: '',
    source: 'tür', notes: '',
    status: initialStatus,
    appt_at: '',
  })
  const [shortNameWarn, setShortNameWarn] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim()) return
    if (form.name.trim().length < 3 && !shortNameWarn) {
      setShortNameWarn(true)
      return
    }
    const data = { ...form, name: form.name.trim() }
    if (form.status === 'termin' && form.appt_at) {
      data.appt_at = new Date(form.appt_at).toISOString()
    } else {
      data.appt_at = null
    }
    onSave(data)
  }

  const statusColor = STATUS_COLORS[form.status] ?? '#F59E0B'
  const statusLabel = STATUS_LABELS[form.status] ?? form.status

  return (
    <BottomSheet
      onClose={onClose}
      footer={
        <button
          className="pressable w-full py-4 rounded-2xl font-bold text-white text-base bg-amber-400"
          onClick={handleSave}
        >
          Speichern
        </button>
      }
    >
      <h2 className="text-base font-bold text-gray-900 mb-4">Kontakt hinzufügen</h2>

      {/* Locked status chip */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</p>
        <span
          className="inline-block px-3 py-1.5 rounded-full text-xs font-bold text-white"
          style={{ background: statusColor }}
        >
          {statusLabel}
        </span>
      </div>

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

      {shortNameWarn && (
        <div className="bg-amber-50 rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
          <span className="text-sm text-amber-800">Kurzer Name — möchtest du noch einen Nachnamen hinzufügen?</span>
          <button className="pressable text-xs font-bold text-amber-600 whitespace-nowrap" onClick={handleSave}>Nein, weiter</button>
        </div>
      )}

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
          <option value="anruf">Anruf / Bestandskunde</option>
          <option value="messe">Messe</option>
          <option value="markt">Markt / Veranstaltung</option>
          <option value="interessent">Eigeninitiative</option>
          <option value="aroundhome">AroundHome</option>
        </select>
      </label>

      {/* Appointment time shown for termin status */}
      {form.status === 'termin' && (
        <label className="block mb-3">
          <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">Datum &amp; Uhrzeit *</span>
          <input type="datetime-local"
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400"
            value={form.appt_at} onChange={e => set('appt_at', e.target.value)} />
        </label>
      )}

      <label className="block mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notiz</span>
        <textarea rows={2} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none resize-none"
          value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional..." />
      </label>
    </BottomSheet>
  )
}

// ─── Manual Bestandskunde Entry Form ─────────────────────────────────────────

function ManualBestandskundeForm({ onClose, isAdmin, salesmen, defaultSalesmanId }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    phone2: '',
    address: '',
    targetUserId: defaultSalesmanId ?? null,
    product: '',
    kaufdatum: '',
    auftragsnummer: '',
    kaufbetrag: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [dupWarning, setDupWarning] = useState(null) // auftragsnummer that duped
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name = true
    if (!form.phone.trim())   e.phone = true
    if (!form.address.trim()) e.address = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const doSave = async (force = false) => {
    if (!validate()) return
    setSaving(true)
    try {
      // Dedup check on Auftragsnummer
      if (form.auftragsnummer.trim() && !force) {
        const { data: existing } = await supabase
          .from('purchases')
          .select('id')
          .eq('order_no', form.auftragsnummer.trim())
          .maybeSingle()
        if (existing) {
          setDupWarning(form.auftragsnummer.trim())
          setSaving(false)
          return
        }
      }

      const { data: authData } = await supabase.auth.getSession()
      const userId = (isAdmin && form.targetUserId) ? form.targetUserId : (authData.session?.user?.id ?? null)

      const { data: contact, error: cErr } = await supabase
        .from('contacts')
        .insert({
          name:           form.name.trim(),
          phone:          form.phone.trim() || null,
          phone2:         form.phone2.trim() || null,
          address:        form.address.trim() || null,
          product:        form.product || null,
          kaufdatum:      form.kaufdatum || null,
          kaufbetrag:     form.kaufbetrag ? parseFloat(form.kaufbetrag) : null,
          auftragsnummer: form.auftragsnummer.trim() || null,
          notes:          form.notes.trim() || null,
          source:         'anruf',
          status:         'anrufen',
          user_id:        userId,
        })
        .select()
        .single()

      if (cErr) throw cErr

      if (form.product || form.kaufdatum || form.kaufbetrag || form.auftragsnummer) {
        await supabase.from('purchases').insert({
          contact_id:   contact.id,
          product:      form.product || null,
          product_raw:  form.product || null,
          amount:       form.kaufbetrag ? parseFloat(form.kaufbetrag) : null,
          purchased_at: form.kaufdatum || null,
          order_no:     form.auftragsnummer.trim() || null,
          origin:       'import',
        })
      }

      onClose()
    } catch (err) {
      console.error('ManualBK save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = (key) =>
    `mt-1 w-full border rounded-xl px-3 py-3 text-sm focus:outline-none ${errors[key] ? 'border-red-400' : 'border-gray-200 focus:border-amber-400'}`

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 pt-5 pb-3 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
        <button className="pressable text-amber-500 font-bold text-lg" onClick={onClose}>✕</button>
        <h2 className="text-base font-extrabold text-gray-900 flex-1">Bestandskunde erfassen</h2>
        <button
          className="pressable px-4 py-2 rounded-xl bg-amber-400 text-white text-sm font-bold disabled:opacity-50"
          disabled={saving}
          onClick={() => doSave(false)}
        >
          {saving ? '...' : 'Speichern'}
        </button>
      </div>

      {/* Dup warning bar */}
      {dupWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-amber-800 flex-1">Auftragsnummer {dupWarning} bereits vorhanden. Trotzdem speichern?</span>
          <button className="pressable text-xs font-bold text-red-600 whitespace-nowrap" onClick={() => { setDupWarning(null); doSave(true) }}>Ja</button>
          <button className="pressable text-xs font-bold text-gray-500 whitespace-nowrap" onClick={() => setDupWarning(null)}>Nein</button>
        </div>
      )}

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-xl mx-auto flex flex-col gap-4">

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name *</span>
            <input type="text" className={fieldClass('name')} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Max Mustermann" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefon 1 *</span>
            <input type="tel" className={fieldClass('phone')} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+49 ..." />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefon 2</span>
            <input type="tel" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400" value={form.phone2} onChange={e => set('phone2', e.target.value)} placeholder="Optional" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Adresse *</span>
            <input type="text" className={fieldClass('address')} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Musterstr. 1, 12345 Stadt" />
          </label>

          {/* Für wen — only shown when admin */}
          {isAdmin && salesmen.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Für wen</span>
              <div className="mt-1 flex gap-2">
                {salesmen.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className="pressable flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all"
                    style={form.targetUserId === s.id
                      ? { background: '#F59E0B', color: '#fff', borderColor: '#F59E0B' }
                      : { background: '#fff', color: '#9CA3AF', borderColor: '#E5E7EB' }}
                    onClick={() => set('targetUserId', s.id)}
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produkt</span>
            <select className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none" value={form.product} onChange={e => set('product', e.target.value)}>
              <option value="">— wählen —</option>
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kaufdatum</span>
            <input type="date" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400" value={form.kaufdatum} onChange={e => set('kaufdatum', e.target.value)} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Auftragsnummer</span>
            <input type="text" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400" value={form.auftragsnummer} onChange={e => set('auftragsnummer', e.target.value)} placeholder="LA..." />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kaufbetrag (€)</span>
            <input type="number" min="0" step="0.01" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-amber-400" value={form.kaufbetrag} onChange={e => set('kaufbetrag', e.target.value)} placeholder="0,00" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notizen</span>
            <textarea rows={3} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional..." />
          </label>

          <button
            className="pressable w-full py-4 rounded-2xl font-bold text-white bg-amber-400 disabled:opacity-50 mt-2"
            disabled={saving}
            onClick={() => doSave(false)}
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
          <button className="pressable w-full py-3 rounded-2xl text-gray-500 text-sm font-medium bg-gray-100" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PDF Import Flow ──────────────────────────────────────────────────────────

function PdfImportFlow({ contacts: existingContacts, onClose, onImported, isAdmin, salesmen, defaultSalesmanId }) {
  const [stage, setStage]         = useState('idle')
  const [progress, setProgress]   = useState({ done: 0, total: 0 })
  const [extracted, setExtracted] = useState([])
  const [selected, setSelected]   = useState({})
  const [targetUserId, setTargetUserId] = useState(defaultSalesmanId ?? null)
  const [summary, setSummary]     = useState(null)
  const fileRef = useRef(null)

  const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

  const processFiles = async (files) => {
    setStage('loading')
    setProgress({ done: 0, total: files.length })
    const results = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const base64 = await fileToBase64(file)
        const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-contract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ pdfBase64: base64 }),
        })
        const json = await res.json()
        results.push({ file: file.name, success: json.success, data: json.data, error: json.error, raw: json.raw })
      } catch (e) {
        results.push({ file: file.name, success: false, error: 'network_error' })
      }
      setProgress({ done: i + 1, total: files.length })
    }

    // Flag duplicates by phone or auftragsnummer
    const withDupes = results.map(r => {
      if (!r.success || !r.data) return r
      const d = r.data
      const primaryPhone = d.phone_privat ?? null
      const dupByPhone = primaryPhone
        ? existingContacts.find(c => c.phone && c.phone.replace(/\s/g,'') === primaryPhone.replace(/\s/g,''))
        : null
      return { ...r, duplicate: dupByPhone ?? null }
    })

    const sel = {}
    withDupes.forEach((r, i) => { if (r.success) sel[i] = true })
    setExtracted(withDupes)
    setSelected(sel)
    setStage('review')
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) processFiles(files)
  }

  const importSelected = async () => {
    setStage('loading')
    setProgress({ done: 0, total: 0 })

    const toImport = extracted.filter((r, i) => r.success && selected[i])
    const { data: authData } = await supabase.auth.getSession()
    const userId = (isAdmin && targetUserId) ? targetUserId : (authData.session?.user?.id ?? null)

    let contactsCreated = 0, contactsMatched = 0, purchasesInserted = 0, skipped = 0

    for (const r of toImport) {
      const d = r.data

      // Dedup by order number
      if (d.auftragsnummer) {
        const { data: existingPurchase } = await supabase
          .from('purchases')
          .select('id')
          .eq('order_no', d.auftragsnummer)
          .maybeSingle()
        if (existingPurchase) {
          skipped++
          continue
        }
      }

      const name = [d.nachname, d.vorname].filter(Boolean).join(', ') || 'Unbekannt'

      // Find or create contact
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .ilike('name', name)
        .maybeSingle()

      let contactId
      if (existingContact) {
        contactId = existingContact.id
        contactsMatched++
      } else {
        const { data: newContact, error: cErr } = await supabase.from('contacts').insert({
          name,
          phone:            d.phone_privat ?? null,
          phone2:           d.phone_firma ?? null,
          address:          [d.strasse, d.plz, d.ort].filter(Boolean).join(', ') || null,
          product:          d.produkt ?? null,
          original_produkt: d.produkt ?? null,
          kaufdatum:        d.datum ?? null,
          kaufbetrag:       d.vereinbarter_preis ?? null,
          auftragsnummer:   d.auftragsnummer ?? null,
          source:           'anruf',
          status:           'anrufen',
          user_id:          userId,
        }).select().single()
        if (cErr) { skipped++; continue }
        contactId = newContact.id
        contactsCreated++
      }

      // Insert purchase row
      const { error: pErr } = await supabase.from('purchases').insert({
        contact_id:   contactId,
        product:      d.produkt ?? null,
        product_raw:  d.produkt ?? null,
        amount:       d.vereinbarter_preis ?? null,
        purchased_at: d.datum ?? null,
        order_no:     d.auftragsnummer ?? null,
        origin:       'import',
      })
      if (!pErr) purchasesInserted++
    }

    setSummary({ contactsCreated, contactsMatched, purchasesInserted, skipped })
    setStage('summary')
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  if (stage === 'idle') {
    return (
      <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
        <div className="sheet-enter w-full bg-white rounded-t-2xl shadow-2xl p-5 pb-8" onClick={e => e.stopPropagation()}>
          <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-4" />
          <h2 className="text-base font-bold text-gray-900 mb-2">PDF-Verträge importieren</h2>
          <p className="text-sm text-gray-500 mb-4">Wähle eine oder mehrere "Verbindliche Bestellung" PDFs aus.</p>

          {/* For-whom toggle in idle stage */}
          {isAdmin && salesmen.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Für wen</p>
              <div className="flex gap-2">
                {salesmen.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className="pressable flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all"
                    style={targetUserId === s.id
                      ? { background: '#F59E0B', color: '#fff', borderColor: '#F59E0B' }
                      : { background: '#fff', color: '#9CA3AF', borderColor: '#E5E7EB' }}
                    onClick={() => setTargetUserId(s.id)}
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={handleFileChange} />
          <button className="pressable w-full py-4 rounded-2xl font-bold text-white bg-purple-500" onClick={() => fileRef.current?.click()}>
            📄 Dateien auswählen
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'loading') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
          <div className="w-10 h-10 rounded-full border-4 border-purple-400 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="font-bold text-gray-900">Lese Verträge...</p>
          {progress.total > 0 && <p className="text-sm text-gray-400 mt-1">({progress.done}/{progress.total})</p>}
        </div>
      </div>
    )
  }

  if (stage === 'summary' && summary) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
          <p className="text-lg font-extrabold text-gray-900 mb-4">Import abgeschlossen</p>
          <div className="flex flex-col gap-2 mb-5">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Neue Kontakte</span><span className="font-bold text-gray-900">{summary.contactsCreated}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Kontakte gefunden</span><span className="font-bold text-gray-900">{summary.contactsMatched}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Käufe eingetragen</span><span className="font-bold text-gray-900">{summary.purchasesInserted}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Übersprungen (Duplikat)</span><span className="font-bold text-gray-900">{summary.skipped}</span></div>
          </div>
          <button className="pressable w-full py-3.5 rounded-2xl bg-amber-400 text-white font-bold" onClick={onImported}>
            Fertig
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <div className="bg-white px-4 pt-5 pb-3 shadow-sm flex items-center gap-3">
        <button className="pressable text-amber-500 font-semibold text-sm" onClick={onClose}>✕</button>
        <h2 className="text-base font-bold text-gray-900 flex-1">{extracted.length} Vertrag{extracted.length !== 1 ? 'e' : ''} erkannt</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {extracted.map((r, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 accent-purple-500"
                checked={!!selected[i] && r.success}
                disabled={!r.success}
                onChange={e => setSelected(s => ({ ...s, [i]: e.target.checked }))}
              />
              <div className="flex-1 min-w-0">
                {r.success ? (
                  <>
                    <p className="font-bold text-gray-900 text-sm">{r.data.nachname}{r.data.vorname ? `, ${r.data.vorname}` : ''}</p>
                    <p className="text-xs text-gray-500">{[r.data.strasse, r.data.plz, r.data.ort].filter(Boolean).join(', ')}</p>
                    <p className="text-xs text-gray-400">{r.data.produkt} · {r.data.vereinbarter_preis ? `€${r.data.vereinbarter_preis.toLocaleString('de-DE')}` : '—'} · {r.data.datum}</p>
                    {r.data.phone_privat && <p className="text-xs text-gray-400">📞 {r.data.phone_privat}{r.data.phone_firma ? ` · ${r.data.phone_firma}` : ''}</p>}
                    {r.duplicate && (
                      <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 rounded-lg px-2 py-1">
                        ⚠️ Mögliches Duplikat: {r.duplicate.name} bereits in Pipeline (Status: {r.duplicate.status})
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-gray-500 text-sm">{r.file}</p>
                    <p className="text-xs text-red-500">Extraktion fehlgeschlagen — manuell prüfen</p>
                  </>
                )}
              </div>
              {!r.success && <span className="text-lg">⚠️</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-8 pt-3 bg-white border-t border-gray-100">
        <button
          className="pressable w-full py-4 rounded-2xl font-bold text-white bg-purple-500 disabled:opacity-50"
          disabled={selectedCount === 0}
          onClick={importSelected}
        >
          Alle importieren ({selectedCount}/{extracted.length})
        </button>
      </div>
    </div>
  )
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
