// Wires up WHEN sync runs (build-plan §5): on app foreground, on regaining
// a connection, and every 60s while online+visible. Deliberately NOT a
// background timer — iOS Safari has no Background Sync API, so a timer
// that only fires while the tab is open and visible is the ceiling of
// what's possible, not a compromise (§5, §9).
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie'
import { runSync } from '../db/sync'
import { useAuth } from './AuthProvider'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const { user } = useAuth()
  const [syncing, setSyncing] = useState(false)
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0

  const syncNow = useCallback(async () => {
    setSyncing(true)
    try {
      await runSync()
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    syncNow() // on login / app open

    const onVisible = () => { if (document.visibilityState === 'visible') syncNow() }
    const onOnline = () => syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const id = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') syncNow()
    }, 60_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      clearInterval(id)
    }
  }, [user?.id, syncNow])

  return (
    <SyncContext.Provider value={{ syncNow, syncing, pending }}>
      {children}
    </SyncContext.Provider>
  )
}

export const useSync = () => useContext(SyncContext)
