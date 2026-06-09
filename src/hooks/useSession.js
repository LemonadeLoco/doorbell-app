import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { SESSION_KEY, OFFLINE_TAPS_KEY } from '../lib/constants'

export function useSession() {
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
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
      setElapsed(0)
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [session?.id])

  const startSession = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .insert({ doors_knocked: 0, conversations: 0 })
      .select()
      .single()
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

  const incrementDoors = () => updateLocal({ _doors: (session?._doors ?? 0) + 1 })
  const incrementConvs  = () => updateLocal({ _convs: (session?._convs ?? 0) + 1 })
  const incrementContacts = () => updateLocal({ _contacts: (session?._contacts ?? 0) + 1 })
  const incrementAppts   = () => updateLocal({ _appts: (session?._appts ?? 0) + 1 })

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
      if (taps.length === 0) return
      await supabase.from('door_taps').insert(taps)
      localStorage.removeItem(OFFLINE_TAPS_KEY)
    } catch {}
  }

  const formatElapsed = () => {
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0')
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
    const s = (elapsed % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return {
    session,
    isActive: !!session,
    elapsed,
    formatElapsed,
    startSession,
    endSession,
    incrementDoors,
    incrementConvs,
    incrementContacts,
    incrementAppts,
    syncOfflineTaps,
  }
}
