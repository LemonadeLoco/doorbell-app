import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function rangeStart(range) {
  const now = new Date()
  if (range === 'today') {
    const d = new Date(now); d.setHours(0,0,0,0); return d.toISOString()
  }
  if (range === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d.toISOString()
  }
  if (range === 'month') {
    const d = new Date(now); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString()
  }
  return null
}

export function useStats(range = 'gesamt') {
  const [stats, setStats] = useState(null)
  const [settings, setSettings] = useState({ revenue_target: 700000, revenue_current: 375000 })

  useEffect(() => {
    loadSettings()
    loadStats()
  }, [range])

  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('*')
    if (data) {
      const map = {}
      data.forEach(r => { map[r.key] = parseFloat(r.value) })
      setSettings(s => ({ ...s, ...map }))
    }
  }

  const loadStats = async () => {
    const start = rangeStart(range)

    let tapsQ = supabase.from('door_taps').select('outcome', { count: 'exact' })
    let contactsQ = supabase.from('contacts').select('status, sale_amount, added_at', { count: 'exact' })
    if (start) {
      tapsQ = tapsQ.gte('tapped_at', start)
      contactsQ = contactsQ.gte('added_at', start)
    }

    const [{ data: taps }, { data: cts }] = await Promise.all([tapsQ, contactsQ])

    const doors = (taps ?? []).length
    const convs = (taps ?? []).filter(t => ['gesprach','kontakt','termin'].includes(t.outcome)).length
    const kontakte = (cts ?? []).filter(c => ['kontakt','termin','verkauft','anrufen'].includes(c.status)).length
    const termine  = (cts ?? []).filter(c => ['termin','verkauft'].includes(c.status)).length
    const verkauft = (cts ?? []).filter(c => c.status === 'verkauft').length
    const revenue  = (cts ?? []).filter(c => c.status === 'verkauft' && c.sale_amount)
                                .reduce((s, c) => s + parseFloat(c.sale_amount), 0)

    setStats({ doors, convs, kontakte, termine, verkauft, revenue })
  }

  return { stats, settings, reload: loadStats }
}
