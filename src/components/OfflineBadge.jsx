// useState: a piece of data that, when changed via its setter, tells React
// "re-render whatever reads this." Plain variables don't do that — reassign
// a normal `let` and the screen never updates, because nothing told React
// to look again.
//
// useEffect: "after this component is on screen, run this code — and if it
// returns a function, run that function when the component leaves the
// screen (cleanup)." Here it's used to subscribe to browser online/offline
// events and unsubscribe when no longer needed, so listeners don't pile up.
import { useEffect, useState } from 'react'

export default function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine)

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

  return (
    <span className={`offline-badge ${online ? 'is-online' : 'is-offline'}`}>
      <span className="offline-badge-dot" />
      {online ? 'Synced' : 'Offline'}
    </span>
  )
}
