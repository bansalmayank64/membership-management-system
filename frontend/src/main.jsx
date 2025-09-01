import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './i18n/i18n'
import setupConsoleFilter from './utils/consoleFilter'
import './utils/logger'

// Apply the console filter early during app startup.
setupConsoleFilter()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
