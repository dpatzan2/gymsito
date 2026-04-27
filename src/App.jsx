import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import TargetDaysForm from './components/TargetDaysForm'
import Dashboard from './components/Dashboard'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '40px' }}>Cargando...</div>
  }

  if (!session) {
    return (
      <div style={{ maxWidth: '400px', margin: '40px auto' }}>
        <h1 style={{ textAlign: 'center' }}>Bienvenido a Gymsito</h1>
        <p style={{ textAlign: 'center' }}>Inicia sesión para continuar</p>
        <Auth 
          supabaseClient={supabase} 
          appearance={{ theme: ThemeSupa }} 
          providers={['google']}
          onlyThirdPartyProviders
        />
      </div>
    )
  }

  if (!profile || !profile.target_days || profile.target_days.length === 0) {
    return (
      <TargetDaysForm 
        user={session.user} 
        onComplete={(days) => setProfile({ ...profile, target_days: days })} 
      />
    )
  }

  return (
    <Dashboard session={session} profile={profile} />
  )
}

export default App
