import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useContacts(filterStatus = null) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    let q = supabase.from('contacts').select('*').order('added_at', { ascending: false })
    if (filterStatus) q = q.eq('status', filterStatus)
    const { data } = await q
    setContacts(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetch()
    const channel = supabase
      .channel('contacts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [filterStatus])

  const addContact = async (contact) => {
    const { data: authData } = await supabase.auth.getSession()
    const userId = authData.session?.user?.id ?? null
    const { data, error } = await supabase.from('contacts').insert({ ...contact, user_id: userId }).select().single()
    if (error) throw error
    return data
  }

  const updateContact = async (id, patch) => {
    const { data, error } = await supabase.from('contacts').update(patch).eq('id', id).select().single()
    if (error) throw error
    setContacts(prev => prev.map(c => c.id === id ? data : c))
    return data
  }

  return { contacts, loading, refetch: fetch, addContact, updateContact }
}
