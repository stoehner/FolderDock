import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installDiagnostics } from './lib/diag'
import './styles/index.css'

installDiagnostics()

const rootEl = document.getElementById('root')
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
