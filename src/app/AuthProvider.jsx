// createContext + useContext: React's way to share a value across many
// components without manually passing it down through every layer of props
// ("prop drilling"). Every screen needs to know "who's logged in?" — instead
// of threading `user` through 10 nested components, any descendant just
// calls useAuth() and reads it directly.
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../db/supabase'
import { seedIfEmpty } from '../db/seed'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // `undefined` (not yet checked) is deliberately distinct from `null`
  // (checked, nobody's logged in) — the route guard in router.jsx uses that
  // difference to avoid a flash-redirect to /login while still loading.
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    // Fires on login, logout, and token refresh — this is how the whole
    // app reacts to auth changes without polling anything.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Runs once per login: seeds the local exercise library + program if this
  // is a fresh device/browser profile.
  useEffect(() => {
    if (session?.user) seedIfEmpty(session.user.id)
  }, [session?.user?.id])

  const value = {
    session,
    user: session?.user ?? null,
    loading: session === undefined,
    signInWithPassword: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
