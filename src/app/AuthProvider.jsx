// createContext + useContext: React's way to share a value across many
// components without threading it through every layer of props ("prop
// drilling"). Every screen needs to know "who's logged in?" — rather than
// passing `user` through ten nested components, any descendant calls
// useAuth() and reads it directly.
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../db/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // `undefined` (not yet checked) is deliberately distinct from `null`
  // (checked, nobody's logged in) — the route guard uses that difference to
  // avoid a flash-redirect to /login while the session is still loading.
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    // With no project configured there is nowhere for this call to go — skip
    // it rather than letting a raw "Failed to fetch" surface from whichever
    // call happened to run first. LoginScreen shows a clear message instead.
    if (!isSupabaseConfigured) {
      setSession(null)
      return
    }

    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null)) // e.g. offline at launch — "logged out", not a crash

    // Fires on login, logout and token refresh — how the whole app reacts to
    // auth changes without polling anything.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // NOTE: first-run seeding deliberately does NOT live here. It has to happen
  // after the first sync pull, or a re-install would seed a fresh exercise
  // library locally while simultaneously pulling the existing one from
  // Supabase — two copies of all 55 exercises. SyncProvider owns it.
  const value = {
    session,
    user: session?.user ?? null,
    loading: session === undefined,
    isSupabaseConfigured,
    signInWithPassword: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
