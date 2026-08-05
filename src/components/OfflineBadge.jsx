// Single sync-status readout (build-plan §5): "Synced" · "Offline · N
// pending" · "Syncing". Nothing more — no progress bars, no per-table detail.
//
// The state mark carries no colour (there is none in this design): solid
// square = synced, hollow = offline/pending, half-filled = syncing. Shape,
// not hue — and the text says it too, so the mark is never load-bearing.
import { useEffect, useState } from 'react'
import { useSync } from '../app/SyncProvider'

export default function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine)
  const sync = useSync()

  // useEffect: "after this component is on screen, run this code — and if it
  // returns a function, run that on the way out (cleanup)." Here it
  // subscribes to the browser's online/offline events and unsubscribes when
  // the component leaves, so listeners don't pile up.
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
      ? (pending ? `Offline · ${pending}` : 'Offline')
      : pending
        ? `${pending} pending`
        : 'Synced'
  const state = sync?.syncing ? 'is-syncing' : online && !pending ? 'is-online' : 'is-offline'

  return (
    <span className={`syncbadge ${state}`}>
      <span className="syncbadge-mark" />
      <span className="label">{label}</span>
    </span>
  )
}
