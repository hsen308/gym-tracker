// Single sync-status readout (build-plan §5): "Synced" · "Offline · N
// pending" · "Syncing". Nothing more — no progress bars, no per-table
// detail. useSync gives the live outbox count via a Dexie live query, so
// this updates the instant a set is confirmed, before any network call.
import { useEffect, useState } from 'react'
import { useSync } from '../app/SyncProvider'

export default function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine)
  const sync = useSync()

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const pending = sync?.pending ?? 0
  const label = sync?.syncing
    ? 'Syncing'
    : !online
      ? `Offline${pending ? ` · ${pending} pending` : ''}`
      : pending
        ? `${pending} pending`
        : 'Synced'
  const state = sync?.syncing ? 'is-syncing' : online && !pending ? 'is-online' : 'is-offline'

  return (
    <span className={`offline-badge ${state}`}>
      <span className="offline-badge-dot" />
      {label}
    </span>
  )
}
