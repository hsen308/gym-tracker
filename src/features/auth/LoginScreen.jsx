import { useState } from 'react'
import { useAuth } from '../../app/AuthProvider'
import Button from '../../components/Button'
import Field from '../../components/Field'

// This is a personal single-user app — there's no public sign-up form.
// Create the one account once, in Supabase → Authentication → Users → Add user,
// then sign in here with that email/password.
export default function LoginScreen() {
  const { signInWithPassword } = useAuth()
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
    <div style={{ padding: 24, maxWidth: 380, margin: '96px auto' }}>
      <h1 className="numeral" style={{ fontSize: 28, marginBottom: 32 }}>Gym Tracker</h1>
      <form onSubmit={submit}>
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <Button type="submit" className="btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
