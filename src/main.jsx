import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/global.css'
import './styles/components.css'

// React doesn't touch the DOM until told to. createRoot() claims the
// <div id="root"> from index.html as React's territory — everything inside
// it from now on is rendered and updated by React, never by manual DOM code.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// When a new service worker takes over an already-open page, the JS running
// right now is the OLD build while the caches are the new one. Reloading once
// puts them back in step. The flag stops the reload looping if a worker
// changes again mid-session.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}
