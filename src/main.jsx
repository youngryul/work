import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PetApp from './PetApp.jsx'
import './index.css'

const searchParams = new URLSearchParams(window.location.search)
const isPetMode = searchParams.get('tauriMode') === 'pet'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPetMode ? <PetApp /> : <App />}
  </React.StrictMode>,
)

