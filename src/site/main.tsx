import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '../styles.css'
import { Site } from './Site'

const root = document.getElementById('root')
if (!root) throw new Error('Missing root')

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <Site />
    </HashRouter>
  </StrictMode>,
)
