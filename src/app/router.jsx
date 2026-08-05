import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import LoginScreen from '../features/auth/LoginScreen'
import TodayScreen from '../features/workout/TodayScreen'
import ActiveWorkout from '../features/workout/ActiveWorkout'

// A route guard: wraps a screen and bounces to /login if nobody's signed
// in. <Navigate> is react-router's declarative version of
// `window.location = ...` — it triggers a redirect during render instead of
// as an imperative side effect.
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null // could be a splash screen; nothing to show yet either way
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/" element={<RequireAuth><TodayScreen /></RequireAuth>} />
      <Route path="/workout/:workoutId" element={<RequireAuth><ActiveWorkout /></RequireAuth>} />
    </Routes>
  )
}
