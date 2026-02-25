import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { ErrorBoundary } from './ErrorBoundary'

// Polyfill global and process for react-native-web/libraries
if (typeof window !== 'undefined') {
  if (!window.global) {
    (window as any).global = window;
  }
  if (!(window as any).process) {
    (window as any).process = { env: { NODE_ENV: import.meta.env.MODE } };
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
  </StrictMode>,
)
