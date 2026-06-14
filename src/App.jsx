import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useSession } from './hooks/useSession'
import { useUserSettings } from './hooks/useUserSettings'
import { BottomNav } from './components/BottomNav'
import { InstallGuide } from './components/InstallGuide'
import { Toast, useToast } from './components/Toast'
import { LoginScreen } from './screens/LoginScreen'
import { HomeScreen } from './screens/HomeScreen'
import { RundeScreen } from './screens/RundeScreen'
import { PipelineScreen } from './screens/PipelineScreen'
import { ContactDetailScreen } from './screens/ContactDetailScreen'
import { StatsScreen } from './screens/StatsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { BestandskundenScreen } from './screens/BestandskundenScreen'
import { CallModeScreen } from './screens/CallModeScreen'

const SALESMAN_KEY = 'doorbell_selected_salesman'
const LUKAS_ID     = 'a0ed7ff1-0c39-4ddb-8045-ec904ce5afcb'

async function autoEndStaleSessions(userId) {
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
  const { data: stale } = await supabase
    .from('sessions')
    .select('id')
    .is('ended_at', null)
    .eq('user_id', userId)
    .lt('started_at', eightHoursAgo)
  if (!stale?.length) return false
  await supabase
    .from('sessions')
    .update({ ended_at: new Date().toISOString() })
    .in('id', stale.map(s => s.id))
  return true
}

export default function App() {
  const [authUser, setAuthUser]           = useState(undefined)
  const [screen, setScreen]               = useState('home')
  const [selectedContact, setSelectedContact] = useState(null)
  const [staleSession, setStaleSession]   = useState(null)

  // Admin context
  const [isAdmin, setIsAdmin]                       = useState(false)
  const [salesmen, setSalesmen]                     = useState([])
  const [selectedSalesmanId, setSelectedSalesmanId] = useState(
    () => localStorage.getItem(SALESMAN_KEY) ?? LUKAS_ID
  )

  const sessionHook  = useSession()
  const settingsHook = useUserSettings()
  const { toast, show } = useToast()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthUser(data.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setAuthUser(s?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Load profile + salesmen list when user is known
  useEffect(() => {
    if (!authUser) { setIsAdmin(false); setSalesmen([]); return }
    const loadProfile = async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, display_name, is_admin')
        .eq('id', authUser.id)
        .maybeSingle()
      const admin = prof?.is_admin ?? false
      setIsAdmin(admin)
      if (admin) {
        const { data: s } = await supabase
          .from('profiles')
          .select('id, display_name')
          .eq('is_admin', false)
          .order('display_name')
        setSalesmen(s ?? [])
      }
    }
    loadProfile()
  }, [authUser])

  const handleSalesmanChange = (id) => {
    setSelectedSalesmanId(id)
    localStorage.setItem(SALESMAN_KEY, id)
  }

  // On auth: auto-end sessions >8h old, then check for short-stale sessions to recover
  useEffect(() => {
    if (!authUser || sessionHook.isActive) return
    const init = async () => {
      const wasAutoEnded = await autoEndStaleSessions(authUser.id)
      if (wasAutoEnded) {
        show('Runde automatisch beendet — sie lief länger als 8 Stunden.')
      }
      const s = await sessionHook.checkStaleSessions()
      if (s) setStaleSession(s)
    }
    init()
  }, [authUser]) // eslint-disable-line react-hooks/exhaustive-deps

  if (authUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!authUser) return <LoginScreen />

  if (staleSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
        <div className="bg-white rounded-2xl p-6 shadow-sm w-full max-w-sm">
          <p className="text-xl font-extrabold text-gray-900 mb-2">Unterbrochene Runde</p>
          <p className="text-sm text-gray-500 mb-2">
            Du hattest eine aktive Runde vom {new Date(staleSession.started_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} Uhr.
          </p>
          <p className="text-sm text-gray-500 mb-5">{staleSession.doors_knocked ?? 0} Türen erfasst.</p>
          <div className="flex flex-col gap-3">
            <button className="pressable w-full py-4 rounded-2xl bg-amber-400 text-white font-bold"
              onClick={() => { sessionHook.resumeSession(staleSession); setStaleSession(null); setScreen('runde') }}>
              Fortfahren
            </button>
            <button className="pressable w-full py-3 rounded-2xl bg-gray-100 text-gray-600 font-semibold"
              onClick={() => { sessionHook.abandonStaleSession(staleSession); setStaleSession(null) }}>
              Beenden &amp; neu starten
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'contact' && selectedContact) {
    return (
      <ContactDetailScreen
        contact={selectedContact}
        onBack={() => { setScreen('pipeline'); setSelectedContact(null) }}
      />
    )
  }
  if (screen === 'settings') {
    return (
      <SettingsScreen
        onBack={() => setScreen('home')}
        userSettings={settingsHook.settings}
        onSave={settingsHook.save}
      />
    )
  }
  if (screen === 'bestandskunden') {
    return <BestandskundenScreen onBack={() => setScreen('pipeline')} />
  }
  if (screen === 'call-mode') {
    return (
      <CallModeScreen
        onBack={() => setScreen('pipeline')}
        isAdmin={isAdmin}
        salesmen={salesmen}
        selectedSalesmanId={selectedSalesmanId}
        onSalesmanChange={handleSalesmanChange}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="min-h-screen">
        {screen === 'home' && (
          <HomeScreen
            setScreen={setScreen}
            sessionData={sessionHook}
            userSettings={settingsHook.settings}
            onContactSelect={c => { setSelectedContact(c); setScreen('contact') }}
            isAdmin={isAdmin}
            selectedSalesmanId={selectedSalesmanId}
            authUser={authUser}
          />
        )}
        {screen === 'runde'    && <RundeScreen sessionHook={sessionHook} />}
        {screen === 'pipeline' && (
          <PipelineScreen
            onContactSelect={c => { setSelectedContact(c); setScreen('contact') }}
            onAddBestandskunde={() => setScreen('bestandskunden')}
            onStartCallMode={() => setScreen('call-mode')}
            isAdmin={isAdmin}
            salesmen={salesmen}
            selectedSalesmanId={selectedSalesmanId}
            onSalesmanChange={handleSalesmanChange}
          />
        )}
        {screen === 'stats' && <StatsScreen userSettings={settingsHook.settings} />}
      </main>
      <BottomNav screen={screen} setScreen={setScreen} sessionActive={sessionHook.isActive} />
      <InstallGuide />
      <Toast toast={toast} />
    </div>
  )
}
