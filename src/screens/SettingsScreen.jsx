import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Toast, useToast } from '../components/Toast'

export function SettingsScreen({ onBack, userSettings, onSave }) {
  const [target, setTarget]   = useState(String(userSettings?.revenue_target ?? 700000))
  const [base, setBase]       = useState(String(userSettings?.revenue_base   ?? 375000))
  const [email, setEmail]     = useState('')
  const { toast, show } = useToast()

  useState(() => {
    supabase.auth.getUser().then(({ data }) => { if (data?.user) setEmail(data.user.email) })
  }, [])

  const handleSave = async (key, value) => {
    const num = parseFloat(value.replace(/\./g, '').replace(',', '.'))
    if (isNaN(num)) return
    await onSave(key, num)
    show('Gespeichert ✓')
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-5 pb-4 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-amber-500 font-semibold text-sm mb-3">
          ← Zurück
        </button>
        <h1 className="text-xl font-extrabold text-gray-900">Einstellungen</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Revenue settings */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Umsatzziele</p>

          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-1">Jahresziel</p>
            <p className="text-xs text-gray-400 mb-2">Zielwert für den Fortschrittsbalken</p>
            <div className="flex gap-2">
              <div className="flex items-center border border-gray-200 rounded-xl flex-1 overflow-hidden">
                <span className="px-3 text-gray-400 font-semibold">€</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="flex-1 py-3 text-sm focus:outline-none pr-3"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                />
              </div>
              <button
                className="btn-press px-4 py-3 bg-amber-400 text-white font-bold text-sm rounded-xl"
                onClick={() => handleSave('revenue_target', target)}
              >
                Speichern
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Basis-Umsatz (vor App)</p>
            <p className="text-xs text-gray-400 mb-2">Bereits erzielte Abschlüsse, die nicht in der App erfasst wurden</p>
            <div className="flex gap-2">
              <div className="flex items-center border border-gray-200 rounded-xl flex-1 overflow-hidden">
                <span className="px-3 text-gray-400 font-semibold">€</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="flex-1 py-3 text-sm focus:outline-none pr-3"
                  value={base}
                  onChange={e => setBase(e.target.value)}
                />
              </div>
              <button
                className="btn-press px-4 py-3 bg-amber-400 text-white font-bold text-sm rounded-xl"
                onClick={() => handleSave('revenue_base', base)}
              >
                Speichern
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Angezeigter Umsatz = Basis + App-Abschlüsse
            </p>
          </div>
        </div>

        {/* User section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Konto</p>
          <p className="text-sm text-gray-500 mb-1">Eingeloggt als</p>
          <p className="text-sm font-semibold text-gray-800 mb-4">{email}</p>
          <button
            className="btn-press w-full py-3 rounded-xl border border-red-200 text-red-600 font-semibold text-sm"
            onClick={() => supabase.auth.signOut()}
          >
            Abmelden
          </button>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
