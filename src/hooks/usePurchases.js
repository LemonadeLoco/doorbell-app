import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function usePurchases(contactId) {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading]     = useState(false)

  const load = useCallback(async () => {
    if (!contactId) return
    setLoading(true)
    const { data } = await supabase
      .from('purchases')
      .select('*')
      .eq('contact_id', contactId)
      .order('purchased_at', { ascending: false })
    setPurchases(data ?? [])
    setLoading(false)
  }, [contactId])

  useEffect(() => { load() }, [load])

  const uploadPdf = useCallback(async (purchaseId, orderNo, file) => {
    const path = `${orderNo}.pdf`
    const { error: upErr } = await supabase.storage
      .from('contracts')
      .upload(path, file, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw upErr

    const { error: dbErr } = await supabase
      .from('purchases')
      .update({ pdf_url: path })
      .eq('id', purchaseId)
    if (dbErr) throw dbErr

    await load()
  }, [load])

  const openPdf = useCallback(async (pdfPath) => {
    const { data, error } = await supabase.storage
      .from('contracts')
      .createSignedUrl(pdfPath, 3600)
    if (error) throw error
    window.open(data.signedUrl, '_blank')
  }, [])

  return { purchases, loading, uploadPdf, openPdf, reload: load }
}
