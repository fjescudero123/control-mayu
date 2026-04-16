import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initMayuHooks } from '@mayu/hooks'
import { getFbDb, getFbStorage, getFbAuth } from './firebase'
import './index.css'
import App from './App.jsx'

initMayuHooks({ db: getFbDb(), storage: getFbStorage(), auth: getFbAuth() })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
