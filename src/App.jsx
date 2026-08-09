import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from './app/AuthProvider'
import { SyncProvider } from './app/SyncProvider'
import { ProfileProvider } from './app/ProfileProvider'
import AppRouter from './app/router'
import ErrorBoundary from './app/ErrorBoundary'

export default function App() {
  return (
    // apple-design §14: reducedMotion="user" makes every <motion.*> in the
    // app automatically obey the OS-level "reduce motion" setting — springs
    // and slides collapse to simple opacity cross-fades — without having to
    // handle prefers-reduced-motion by hand in each component.
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          {/* Needs useAuth (to know when to start/stop syncing), so it nests
              inside AuthProvider rather than sitting beside it. */}
          {/* Above SyncProvider: seeding needs to know which programme the
              profile asks for before it writes anything. */}
          <ProfileProvider>
            <SyncProvider>
              {/* Inside the providers so a crashed screen still shows the
                  error page rather than a blank document. */}
              <ErrorBoundary>
                <AppRouter />
              </ErrorBoundary>
            </SyncProvider>
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
