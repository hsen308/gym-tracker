import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { useProfile } from './ProfileProvider'
import TabBar from '../components/TabBar'
import LoginScreen from '../features/auth/LoginScreen'
// Eager, not lazy: it's the first thing a new account sees, and a chunk
// fetch at that moment is the worst possible first impression.
import SetupScreen from '../features/setup/SetupScreen'

// The logging path — login, Today, ActiveWorkout — is imported eagerly. It's
// what you open in a gym basement, and a lazy chunk that has to be fetched
// there is a chunk you don't get (build-plan §0 rule 2: the app must fully
// function with airplane mode on).
import TodayScreen from '../features/workout/TodayScreen'
import DayPreview from '../features/workout/DayPreview'
import ActiveWorkout from '../features/workout/ActiveWorkout'

// Everything else is split out. These screens are read at a desk or on the
// sofa, and keeping them out of the initial bundle means the part that has
// to work on bad mobile data stays small. The service worker precaches the
// chunks anyway, so after the first visit they're local too.
const SettingsScreen = lazy(() => import('../features/settings/SettingsScreen'))
const HistoryList = lazy(() => import('../features/history/HistoryList'))
const WorkoutDetail = lazy(() => import('../features/history/WorkoutDetail'))
const ExerciseHistory = lazy(() => import('../features/history/ExerciseHistory'))
const BodyScreen = lazy(() => import('../features/body/BodyScreen'))
const InsightsScreen = lazy(() => import('../features/insights/InsightsScreen'))
const MealsScreen = lazy(() => import('../features/meals/MealsScreen'))

// ActiveWorkout deliberately opts out — the logging path stays
// distraction-free (build-plan §0 rule 3), nothing competes with it for
// the bottom of the screen except the rest timer.
// Suspense is what React shows while a lazy chunk is still downloading.
// The fallback is deliberately blank rather than a spinner: these chunks are
// tens of kB and precached, so a flash of "loading…" would be more visually
// disruptive than the momentary gap it replaces.
function WithTabBar({ children }) {
  return (
    <div className="with-tab-bar">
      <Suspense fallback={null}>{children}</Suspense>
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
  const { loading: profileLoading, exists } = useProfile()

  if (loading || profileLoading) return null // could be a splash; nothing to show either way
  if (!user) return <Navigate to="/login" replace />
  // A signed-in account with no profile has never been set up. It gets the
  // wizard instead of the app — the alternative is handing a new person
  // someone else's programme, calorie target and injury protocol.
  if (!exists) return <SetupScreen />
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
      {/* Preview keeps the tab bar — it's a browsing screen. ActiveWorkout
          deliberately opts out: the logging path stays distraction-free
          (build-plan §0 rule 3). */}
      <Route path="/day/:dayId" element={<RequireAuth><WithTabBar><DayPreview /></WithTabBar></RequireAuth>} />
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
