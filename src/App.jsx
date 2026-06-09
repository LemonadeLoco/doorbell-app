import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useSession } from './hooks/useSession'
import { BottomNav } from './components/BottomNav'
import { LoginScreen } from './screens/LoginScreen'
import { HomeScreen } from './screens/HomeScreen'
import { RundeScreen } from './screens/RundeScreen'
import { PipelineScreen } from './screens/PipelineScreen'
import { ContactDetailScreen } from './screens/ContactDetailScreen'
import { StatsScreen } from './screens/StatsScreen'

export default function App() {
  const [authUser, setAuthUser] = useState(undefined)
  const [screen, setScreen] = useState('home')
  const [selectedContact, setSelectedContact] = useState(null)
  const sessionHook = useSession()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (authUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!authUser) return <LoginScreen />

  if (screen === 'contact' && selectedContact) {
    return (
      <ContactDetailScreen
        contact={selectedContact}
        onBack={() => { setScreen('pipeline'); setSelectedContact(null) }}
      />
    )
  }

  const handleContactSelect = (c) => {
    setSelectedContact(c)
    setScreen('contact')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="min-h-screen">
        {screen === 'home'     && <HomeScreen setScreen={setScreen} sessionData={sessionHook} />}
        {screen === 'runde'    && <RundeScreen sessionHook={sessionHook} />}
        {screen === 'pipeline' && <PipelineScreen onContactSelect={handleContactSelect} />}
        {screen === 'stats'    && <StatsScreen />}
      </main>
      <BottomNav screen={screen} setScreen={setScreen} sessionActive={sessionHook.isActive} />
    </div>
  )
}
