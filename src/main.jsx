import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const searchParams = new URLSearchParams(window.location.search)
const isPetMode = searchParams.get('tauriMode') === 'pet'

const PetApp = isPetMode ? lazy(() => import('./PetApp.jsx')) : null

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPetMode && PetApp
      ? <Suspense fallback={null}><PetApp /></Suspense>
      : <App />}
  </React.StrictMode>,
)

