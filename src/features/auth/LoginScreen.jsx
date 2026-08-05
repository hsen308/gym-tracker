import { useState } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '../../app/AuthProvider'
import Button from '../../components/Button'
import Field from '../../components/Field'
import Logomark from '../../components/Logomark'

// Personal single-user app — there's no public sign-up form. The one account
// is created once in Supabase → Authentication → Users → Add user.
export default function LoginScreen() {
  const { signInWithPassword, isSupabaseConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault() // stop the browser's default full-page-reload submit
    setBusy(true)
    setError('')
    const { error } = await signInWithPassword(email, password)
    setBusy(false)
    if (error) setError(error.message)
    // On success, onAuthStateChange fires in AuthProvider and the router
    // redirects off /login automatically — no manual navigate() here.
  }

  return (
    <div className="login-shell">
      {/* A spring, not a scripted keyframe (apple-design §4): critically
          damped so it settles once without overshoot. MotionConfig at the app
          root already collapses this to a plain fade under reduced motion. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
      >
        <div className="login-mark"><Logomark size={34} /></div>
        <h1 className="readout login-title">GYM<br />TRACKER</h1>
        <p className="label">Training log · Built for Hussein</p>

        {!isSupabaseConfigured ? (
          <p className="login-note">
            No Supabase project connected. Fill in <code>.env.local</code> with your project URL
            and anon key, then restart the dev server.
          </p>
        ) : (
          <form onSubmit={submit} className="login-form">
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            {error && <p className="mono" style={{ fontSize: 13 }}>{error}</p>}
            <Button type="submit" className="btn-block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
