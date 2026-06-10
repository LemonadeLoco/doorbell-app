export const PRODUCTS = [
  'Haustür',
  'Kunststofffenster',
  'Rollläden',
  'Markise',
  'Terrassendach',
  'Garagentor',
  'Vordach',
  'Dachfensterrollladen',
  'Zip-Screen',
  'Sonstiges',
]

export const STATUSES = {
  anrufen:       { label: 'Anrufen',       bg: '#DBEAFE', text: '#1E40AF' },
  kontakt:       { label: 'Kontakt',       bg: '#FEF3C7', text: '#92400E' },
  termin:        { label: 'Termin',        bg: '#D1FAE5', text: '#065F46' },
  verkauft:      { label: 'Verkauft',      bg: '#EDE9FE', text: '#5B21B6' },
  kein_int:      { label: 'Kein Int.',     bg: '#FEE2E2', text: '#991B1B' },
  wiedervorlage: { label: 'Wiedervorlage', bg: '#EFF6FF', text: '#1D4ED8' },
  archiv:        { label: 'Archiv',        bg: '#F3F4F6', text: '#6B7280' },
}

export const SOURCES = {
  'tür':   { label: 'Haustür',       bg: '#FFEDD5', text: '#9A3412' },
  'anruf': { label: 'Bestandskunde', bg: '#EDE9FE', text: '#5B21B6' },
}

export const OFFLINE_TAPS_KEY = 'doorbell_offline_taps'
export const SESSION_KEY       = 'doorbell_active_session'

export const WEEKDAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
export const WEEKDAYS_LONG_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export const formatDateSmart = (dateString) => {
  if (!dateString) return ''
  const d = new Date(dateString)
  const isThisYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    ...(isThisYear ? {} : { year: 'numeric' }),
  })
}
