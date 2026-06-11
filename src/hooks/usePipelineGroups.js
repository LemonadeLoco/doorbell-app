import { useMemo } from 'react'

export function usePipelineGroups(contacts) {
  return useMemo(() => {
    const now   = Date.now()
    const today = new Date().toISOString().split('T')[0]
    const cut48 = new Date(now + 48 * 3600 * 1000).toISOString()

    const urgent   = []
    const active   = []
    const archived = []

    contacts.forEach(c => {
      if (c.status === 'kein_int' || c.status === 'archiv') {
        archived.push(c)
        return
      }

      const urgentTermin  = c.status === 'termin'        && c.appt_at    && c.appt_at > new Date(now).toISOString() && c.appt_at <= cut48
      const urgentWV      = c.status === 'wiedervorlage' && (!c.followup_at || c.followup_at.split('T')[0] <= today)
      const urgentKontakt = c.status === 'kontakt'       && c.added_at   && (now - new Date(c.added_at).getTime()) < 72 * 3600 * 1000

      if (urgentTermin || urgentWV || urgentKontakt) {
        urgent.push(c)
      } else {
        active.push(c)
      }
    })

    urgent.sort((a, b) => {
      const rank = c => {
        if (c.status === 'termin')        return 0
        if (c.status === 'wiedervorlage') return 1
        if (c.status === 'kontakt')       return 2
        return 3
      }
      const d = rank(a) - rank(b)
      if (d !== 0) return d
      if (a.status === 'termin')        return (a.appt_at    ?? '').localeCompare(b.appt_at    ?? '')
      if (a.status === 'wiedervorlage') return (a.followup_at ?? '0').localeCompare(b.followup_at ?? '0')
      return (b.added_at ?? '').localeCompare(a.added_at ?? '')
    })

    active.sort((a, b) =>
      (b.updated_at ?? b.added_at ?? '').localeCompare(a.updated_at ?? a.added_at ?? '')
    )

    return { urgent, active, archived }
  }, [contacts])
}
