import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { SESSION_KEY, OFFLINE_TAPS_KEY } from '../lib/constants'

export function useSession() {
  const [session, setSession] = useState(() => {
    try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (session) {
      const startMs = new Date(session.started_at).getTime()
      const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
      tick()
      timerRef.current = setInterval(tick, 1000)
    } else {
      setElapsed(0); clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [session?.id])

  const startSession = async (gebiet = null) => {
    const { data: authData } = await supabase.auth.getSession()
    const userId = authData.session?.user?.id ?? null
    const insertData = { doors_knocked: 0, conversations: 0, user_id: userId }
    if (gebiet) insertData.gebiet = gebiet
    const { data, error } = await supabase.from('sessions').insert(insertData).select().single()
    if (error) throw error
    const s = { ...data, _doors: 0, _convs: 0, _contacts: 0, _appts: 0 }
    setSession(s)
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    return s
  }

  const updateLocal = (patch) => {
    setSession(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(SESSION_KEY, JSON.stringify(next))
      return next
    })
  }

  const increment = (key, amount = 1) =>
    updateLocal({ [key]: Math.max(0, ((session?.[key]) ?? 0) + amount) })

  const incrementDoors    = () => increment('_doors')
  const incrementConvs    = () => increment('_convs')
  const incrementContacts = () => increment('_contacts')
  const incrementAppts    = () => increment('_appts')

  const decrementDoors    = () => increment('_doors', -1)
  const decrementConvs    = () => increment('_convs', -1)
  const decrementContacts = () => increment('_contacts', -1)
  const decrementAppts    = () => increment('_appts', -1)

  const endSession = async () => {
    if (!session) return
    await supabase.from('sessions').update({
      ended_at: new Date().toISOString(),
      doors_knocked: session._doors ?? 0,
      conversations: session._convs ?? 0,
    }).eq('id', session.id)
    await syncOfflineTaps()
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  const syncOfflineTaps = async () => {
    try {
      const raw = localStorage.getItem(OFFLINE_TAPS_KEY)
      if (!raw) return
      const taps = JSON.parse(raw)
      if (!taps.length) return
      await supabase.from('door_taps').insert(taps.map(t => { const { _localId, ...rest } = t; return rest }))
      localStorage.removeItem(OFFLINE_TAPS_KEY)
    } catch {}
  }

  // Check if there's a stale session from a previous crash (started >5 min ago, not ended)
  const checkStaleSessions = async () => {
    const { data: authData } = await supabase.auth.getSession()
    const userId = authData.session?.user?.id
    if (!userId) return null
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .lt('started_at', fiveMinAgo)
      .order('started_at', { ascending: false })
      .limit(1)
    return data?.[0] ?? null
  }

  const resumeSession = (dbSession) => {
    const s = { ...dbSession, _doors: dbSession.doors_knocked ?? 0, _convs: dbSession.conversations ?? 0, _contacts: 0, _appts: 0 }
    setSession(s)
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  }

  const abandonStaleSession = async (dbSession) => {
    await supabase.from('sessions').update({ ended_at: new Date().toISOString() }).eq('id', dbSession.id)
  }

  const formatElapsed = () => {
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0')
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
    const s = (elapsed % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return {
    session, isActive: !!session, elapsed, formatElapsed,
    startSession, endSession, syncOfflineTaps,
    incrementDoors, incrementConvs, incrementContacts, incrementAppts,
    decrementDoors, decrementConvs, decrementContacts, decrementAppts,
    checkStaleSessions, resumeSession, abandonStaleSession,
  }
}
