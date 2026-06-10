import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'installDismissedAt'

function shouldShow() {
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  if (isStandalone) return false

  const last = localStorage.getItem(DISMISSED_KEY)
  if (!last) return true
  // Show again after 24h
  return Date.now() - parseInt(last) > 86400000
}

export function InstallGuide() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Small delay so the app renders first
    const t = setTimeout(() => setVisible(shouldShow()), 800)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  const isChrome = navigator.userAgent.includes('CriOS')
  const appUrl   = window.location.href

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="sheet-enter w-full bg-white rounded-t-3xl p-6 pb-10 shadow-2xl">
        <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-5" />

        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏠</div>
          <h2 className="text-xl font-extrabold text-gray-900">Zum Startbildschirm</h2>
          <p className="text-sm text-gray-500 mt-1">Installiere die App für den besten Einsatz im Feld</p>
        </div>

        {isChrome && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
            <span className="text-base mt-0.5">⚠️</span>
            <p className="text-sm text-amber-800">Du nutzt Chrome. Für die Installation muss <strong>Safari</strong> verwendet werden.</p>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          {[
            { step: '1', icon: '□↑', label: 'Tippe auf das Teilen-Symbol unten in Safari', sub: '(das Symbol mit dem Pfeil nach oben)' },
            { step: '2', icon: '📋', label: 'Scrolle runter und tippe auf', sub: '"Zum Home-Bildschirm"' },
            { step: '3', icon: '✓',  label: 'Tippe oben rechts auf', sub: '"Hinzufügen"' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-400 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {item.step}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                <p className="text-sm text-gray-400">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center mb-5">
          Danach öffnet die App direkt ohne Browser — wie eine echte App.
        </p>

        {isChrome && (
          <a
            href={`x-web-search://?${appUrl}`}
            className="pressable block w-full py-3.5 rounded-2xl bg-amber-400 text-white font-bold text-sm text-center mb-3"
            onClick={dismiss}
          >
            Jetzt in Safari öffnen ↗
          </a>
        )}

        <button onClick={dismiss} className="pressable w-full py-3 text-gray-400 text-sm font-medium text-center">
          Erstmal überspringen
        </button>
      </div>
    </div>
  )
}
