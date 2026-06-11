import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useActiveSessions() {
  const [activeSessions, setActiveSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()

    const channel = supabase
      .channel('live-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'door_taps' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const load = async () => {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .is('ended_at', null)

    if (!sessions || sessions.length === 0) {
      setActiveSessions([])
      setLoading(false)
      return
    }

    const userIds    = sessions.map(s => s.user_id).filter(Boolean)
    const sessionIds = sessions.map(s => s.id)

    const [profilesRes, tapsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('profiles').select('id, display_name, color').in('id', userIds)
        : { data: [] },
      supabase.from('door_taps').select('session_id, outcome').in('session_id', sessionIds),
    ])

    const profileMap = {}
    ;(profilesRes.data ?? []).forEach(p => { profileMap[p.id] = p })

    const doorsBySession   = {}
    const termineBySession = {}
    ;(tapsRes.data ?? []).forEach(tap => {
      doorsBySession[tap.session_id] = (doorsBySession[tap.session_id] ?? 0) + 1
      if (tap.outcome === 'termin') {
        termineBySession[tap.session_id] = (termineBySession[tap.session_id] ?? 0) + 1
      }
    })

    const enriched = sessions.map(s => {
      const profile      = s.user_id ? profileMap[s.user_id] : null
      const emailPrefix  = s.email?.split('@')[0] ?? null
      return {
        ...s,
        profile,
        displayName: profile?.display_name ?? emailPrefix ?? 'Rep',
        color:       profile?.color ?? '#F59E0B',
        doors:       doorsBySession[s.id]   ?? 0,
        termine:     termineBySession[s.id] ?? 0,
      }
    })

    setActiveSessions(enriched)
    setLoading(false)
  }

  return { activeSessions, loading }
}
