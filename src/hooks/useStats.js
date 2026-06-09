import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function rangeStart(range) {
  const now = new Date()
  if (range === 'today') { const d = new Date(now); d.setHours(0,0,0,0); return d.toISOString() }
  if (range === 'week')  { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d.toISOString() }
  if (range === 'month') { const d = new Date(now); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString() }
  return null
}

export function useStats(range = 'gesamt', userSettings = null) {
  const [stats, setStats] = useState(null)

  useEffect(() => { load() }, [range, userSettings?.revenue_base])

  const load = async () => {
    const start = rangeStart(range)
    let tapsQ     = supabase.from('door_taps').select('outcome')
    let contactsQ = supabase.from('contacts').select('status, sale_amount, added_at')
    if (start) { tapsQ = tapsQ.gte('tapped_at', start); contactsQ = contactsQ.gte('added_at', start) }

    // Revenue always uses all-time sales + base
    const salesQ = supabase.from('contacts').select('sale_amount').eq('status', 'verkauft')

    const [{ data: taps }, { data: cts }, { data: sales }] = await Promise.all([tapsQ, contactsQ, salesQ])

    const doors    = (taps ?? []).length
    const convs    = (taps ?? []).filter(t => ['gesprach','kontakt','termin'].includes(t.outcome)).length
    const kontakte = (cts  ?? []).filter(c => ['anrufen','kontakt','termin','verkauft'].includes(c.status)).length
    const termine  = (cts  ?? []).filter(c => ['termin','verkauft'].includes(c.status)).length
    const verkauft = (cts  ?? []).filter(c => c.status === 'verkauft').length

    const salesRevenue = (sales ?? []).reduce((s, c) => s + (parseFloat(c.sale_amount) || 0), 0)
    const base = userSettings?.revenue_base ?? 0
    const revenue = base + salesRevenue

    setStats({ doors, convs, kontakte, termine, verkauft, revenue, salesRevenue })
  }

  return { stats, reload: load }
}
