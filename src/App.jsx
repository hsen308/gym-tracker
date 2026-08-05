import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from './app/AuthProvider'
import AppRouter from './app/router'

export default function App() {
  return (
    // apple-design §14: reducedMotion="user" makes every <motion.*> in the
    // app automatically obey the OS-level "reduce motion" setting — springs
    // and slides collapse to simple opacity cross-fades — without having to
    // handle prefers-reduced-motion by hand in each component.
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
