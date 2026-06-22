import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAllCallAttempts() {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('call_attempts')
      .select('*, contacts(id, name, phone)')
      .order('attempted_at', { ascending: false })
      .limit(200)
    setAttempts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { attempts, loading, reload: load }
}
