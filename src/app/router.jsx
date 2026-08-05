import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import TabBar from '../components/TabBar'
import LoginScreen from '../features/auth/LoginScreen'
import TodayScreen from '../features/workout/TodayScreen'
import ActiveWorkout from '../features/workout/ActiveWorkout'
import SettingsScreen from '../features/settings/SettingsScreen'
import HistoryList from '../features/history/HistoryList'
import WorkoutDetail from '../features/history/WorkoutDetail'
import ExerciseHistory from '../features/history/ExerciseHistory'
import BodyScreen from '../features/body/BodyScreen'
import InsightsScreen from '../features/insights/InsightsScreen'
import MealsScreen from '../features/meals/MealsScreen'

// ActiveWorkout deliberately opts out — the logging path stays
// distraction-free (build-plan §0 rule 3), nothing competes with it for
// the bottom of the screen except the rest timer.
function WithTabBar({ children }) {
  return (
    <div className="with-tab-bar">
      {children}
      <TabBar />
    </div>
  )
}

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

// The inverse of RequireAuth. Without this, a successful sign-in updates
// `user` internally but nothing ever leaves the /login route to show it —
// the form just sits there with no error and no visible change, which
// looks exactly like a failed login even though auth succeeded.
function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return children
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><LoginScreen /></RedirectIfAuthed>} />
      <Route path="/" element={<RequireAuth><WithTabBar><TodayScreen /></WithTabBar></RequireAuth>} />
      <Route path="/workout/:workoutId" element={<RequireAuth><ActiveWorkout /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><WithTabBar><SettingsScreen /></WithTabBar></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><WithTabBar><HistoryList /></WithTabBar></RequireAuth>} />
      <Route path="/history/:workoutId" element={<RequireAuth><WithTabBar><WorkoutDetail /></WithTabBar></RequireAuth>} />
      <Route path="/exercise/:exerciseId" element={<RequireAuth><WithTabBar><ExerciseHistory /></WithTabBar></RequireAuth>} />
      <Route path="/body" element={<RequireAuth><WithTabBar><BodyScreen /></WithTabBar></RequireAuth>} />
      <Route path="/insights" element={<RequireAuth><WithTabBar><InsightsScreen /></WithTabBar></RequireAuth>} />
      <Route path="/meals" element={<RequireAuth><WithTabBar><MealsScreen /></WithTabBar></RequireAuth>} />
    </Routes>
  )
}
