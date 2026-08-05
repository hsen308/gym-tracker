import { useEffect } from 'react'

export default function Toast({ message, onDismiss, duration = 3000 }) {
  // Runs whenever `message` changes. Sets a timer to auto-dismiss; the
  // cleanup function (the `return () => ...`) cancels a stale timer if a
  // new message arrives before the old one finished — otherwise two
  // messages in quick succession could dismiss each other early.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [message, duration, onDismiss])

  if (!message) return null
  return <div className="toast">{message}</div>
}
