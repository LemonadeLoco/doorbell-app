import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useCallQueue() {
  const [queue, setQueue]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('call_queue').select('*')
    setQueue(data ?? [])
    setLoading(false)
  }, [])

  return { queue, loading, load }
}
