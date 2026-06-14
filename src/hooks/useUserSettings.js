import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useUserSettings() {
  const [settings, setSettings] = useState({ revenue_target: 0, revenue_base: 0 })
  const [userId, setUserId] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await supabase
      .from('user_settings')
      .select('key, value')
      .eq('user_id', user.id)
    if (data?.length) {
      const map = {}
      data.forEach(r => { map[r.key] = parseFloat(r.value) })
      setSettings(s => ({ ...s, ...map }))
    }
    setLoaded(true)
  }

  const save = async (key, value) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSettings(s => ({ ...s, [key]: parseFloat(value) }))
    await supabase.from('user_settings').upsert({ user_id: user.id, key, value: String(value) })
  }

  return { settings, save, userId, loaded, reload: load }
}
