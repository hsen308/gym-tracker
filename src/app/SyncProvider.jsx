// Owns WHEN sync runs (build-plan §5): on app foreground, on regaining a
// connection, and every 60s while online and visible. Deliberately NOT a
// background timer — iOS Safari has no Background Sync API, so "only while
// the tab is open and visible" is the ceiling of what's possible, not a
// compromise (§5, §9).
//
// Also owns first-run seeding, because the two are ordered: seeding must not
// start until the first pull has finished, or a re-install seeds a second
// copy of the exercise library on top of the one it's pulling down.
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie'
import { runSync } from '../db/sync'
import { seedIfEmpty } from '../db/seed'
import { useAuth } from './AuthProvider'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const { user } = useAuth()
  const [syncing, setSyncing] = useState(false)
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0
  const seededFor = useRef(null)

  // Watched, not read once: on a brand-new account the profile doesn't exist
  // until setup finishes, and seeding has to run the moment it appears.
  // Reading it a single time at mount would leave a new user with a chosen
  // programme and an empty app until they reloaded.
  const templateKey = useLiveQuery(
    async () => (user ? (await db.profiles.where('user_id').equals(user.id).first())?.program_template ?? null : null),
    [user?.id],
  )

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
    let cancelled = false

    // First pass on login: pull whatever the server already has, THEN seed if
    // we still came up empty. If the pull fails (offline first run) we seed
    // anyway — the app has to work with no signal, rule #2 — accepting that a
    // device seeded entirely offline against a non-empty server could need a
    // manual cleanup. In practice a first login is online.
    const bootstrap = async () => {
      await syncNow()
      if (cancelled) return

      // Seeding needs the profile: it decides which programme is written and
      // whether the SI-joint cautions apply. A brand-new account has no
      // profile until it finishes setup, so there is nothing to seed yet —
      // writing the default programme here would hand every new user someone
      // else's training plan before they'd answered a single question.
      const profile = await db.profiles.where('user_id').equals(user.id).first()
      if (!profile) return

      const stamp = `${user.id}:${profile.program_template}`
      if (seededFor.current === stamp) return
      seededFor.current = stamp

      await seedIfEmpty(user.id, profile)
      if (!cancelled) await syncNow() // push whatever seeding just created
    }
    bootstrap()

    const onVisible = () => { if (document.visibilityState === 'visible') syncNow() }
    const onOnline = () => syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const id = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') syncNow()
    }, 60_000)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      clearInterval(id)
    }
  }, [user?.id, templateKey, syncNow])

  return (
    <SyncContext.Provider value={{ syncNow, syncing, pending }}>
      {children}
    </SyncContext.Provider>
  )
}

export const useSync = () => useContext(SyncContext)
