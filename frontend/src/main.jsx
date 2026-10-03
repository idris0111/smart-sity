import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './product.css'
import './command-center.css'
import './appearance.css'
import App from './App.jsx'
import { HashRouter } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter><App /></HashRouter>
  </React.StrictMode>,
)
