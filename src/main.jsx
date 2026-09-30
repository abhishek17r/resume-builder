import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Colour palette (see index.css). rw.theme overrides the default, for trying palettes.
const THEMES = ['coral', 'ocean', 'teal', 'lagoon']
const DEFAULT_THEME = 'coral'
let theme = DEFAULT_THEME
try { theme = localStorage.getItem('rw.theme') ?? DEFAULT_THEME } catch { /* private mode */ }
document.documentElement.dataset.theme = THEMES.includes(theme) ? theme : DEFAULT_THEME

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
