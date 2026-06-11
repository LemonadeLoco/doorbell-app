import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useCallAttempts(contactId) {
  const [attempts, setAttempts] = useState([])

  useEffect(() => {
    if (!contactId) return
    load()
  }, [contactId])

  const load = async () => {
    const { data } = await supabase
      .from('call_attempts')
      .select('*')
      .eq('contact_id', contactId)
      .order('attempted_at', { ascending: false })
    setAttempts(data ?? [])
  }

  const log = async (outcome, notes = null) => {
    const { data: authData } = await supabase.auth.getSession()
    const userId = authData.session?.user?.id ?? null
    const entry = { contact_id: contactId, outcome, notes, attempted_at: new Date().toISOString(), user_id: userId }
    setAttempts(prev => [entry, ...prev])
    await supabase.from('call_attempts').insert(entry)
    await load()
    return attempts.filter(a => ['nicht_erreicht','mailbox'].includes(a.outcome)).length + 1
  }

  const failCount = attempts.filter(a => ['nicht_erreicht','mailbox'].includes(a.outcome)).length

  return { attempts, log, failCount, reload: load }
}
