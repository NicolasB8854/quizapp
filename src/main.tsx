import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadBundledCatalog } from '@quizapp/shared'
import App from './App'
// Fonts selbst gehostet (kein Google-Request, kein Render-Blocking, DSGVO).
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/montserrat/wght.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fragenkatalog im Leerlauf vorladen: Start-Seite rendert ohne ihn, aber bis
// zur Solo-Runde oder Lobby liegt er meist schon im Cache.
const prefetch = () => void loadBundledCatalog().catch(() => undefined)
if ('requestIdleCallback' in window) window.requestIdleCallback(prefetch, { timeout: 3000 })
else setTimeout(prefetch, 1500)
