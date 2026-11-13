import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import useStore, { applyThemeToDom } from './store/useStore'

// Ensure theme is applied immediately on boot
try {
  applyThemeToDom(useStore.getState().theme || 'dark')
} catch (_e) {}

// Ensure Firebase Auth authorized domain compatibility:
// In local dev, Firebase authorizes 'localhost' by default, while '127.0.0.1' requires manual console addition.
// Seamlessly normalize 127.0.0.1 to localhost so Google Sign-In and OAuth work out-of-the-box.
if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
  const targetUrl = new URL(window.location.href)
  targetUrl.hostname = 'localhost'
  window.location.replace(targetUrl.toString())
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
