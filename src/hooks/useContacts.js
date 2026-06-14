import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useContacts(filterStatus = null, salesmanId = null) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    // Always filter by user_id: admin passes a specific salesmanId; non-admin uses own auth.uid()
    let effectiveUserId = salesmanId
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser()
      effectiveUserId = user?.id ?? null
    }
    let q = supabase.from('contacts').select('*').order('added_at', { ascending: false })
    if (filterStatus) q = q.eq('status', filterStatus)
    if (effectiveUserId) q = q.eq('user_id', effectiveUserId)
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
  }, [filterStatus, salesmanId]) // eslint-disable-line react-hooks/exhaustive-deps

  const addContact = async (contact, targetUserId = null) => {
    const { data: authData } = await supabase.auth.getSession()
    const userId = targetUserId ?? authData.session?.user?.id ?? null
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
