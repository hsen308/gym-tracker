import { useState } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '../../app/AuthProvider'
import Button from '../../components/Button'
import Field from '../../components/Field'
import Logomark from '../../components/Logomark'

// This is a personal single-user app — there's no public sign-up form.
// Create the one account once, in Supabase → Authentication → Users → Add user,
// then sign in here with that email/password.
export default function LoginScreen() {
  const { signInWithPassword, isSupabaseConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault() // stop the browser's default full-page-reload form submit
    setBusy(true)
    setError('')
    const { error } = await signInWithPassword(email, password)
    setBusy(false)
    if (error) setError(error.message)
    // On success, onAuthStateChange in AuthProvider fires and the router
    // guard re-renders past /login automatically — no manual redirect here.
  }

  return (
    <div className="login-shell">
      {/* Entrance motion, not a scripted keyframe animation (apple-design §4)
          — a critically-damped spring settles once and doesn't fight
          interruption. MotionConfig at the app root already collapses this
          to a plain fade when the OS asks for reduced motion. */}
      <motion.div
        className="card login-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      >
        <Logomark size={44} />
        <div className="login-heading">
          <h1 className="numeral" style={{ fontSize: 24 }}>Gym Tracker</h1>
          <p className="faint" style={{ fontSize: 13 }}>Training log</p>
        </div>

        {!isSupabaseConfigured ? (
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            No Supabase project connected yet. Fill in <code>.env.local</code> with your project
            URL and anon key, then restart the dev server.
          </p>
        ) : (
          <form onSubmit={submit} className="stack-3">
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
            <Button type="submit" className="btn-block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
