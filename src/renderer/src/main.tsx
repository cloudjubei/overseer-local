// Tailwind v4 + thefactory-ui style bundle. `index.css` is a pure 2-line shim
// (`@import 'tailwindcss'; @import 'thefactory-ui/web/styles';`) so PostCSS
// doesn't flag anything as "must precede other statements". Screen-level CSS
// (Stories / Story details / Board / Docs / Settings) is now part of the
// package bundle — see `thefactory-ui/src/web/styles/screens/`.
import './index.css'
// App-level rules (body / html / h1-h3 / .empty).
import './styles/app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'

// `HashRouter` (vs web's `BrowserRouter`) because the renderer loads from
// `file://` in production; HTML5 history routing needs a real HTTP origin.
// All inner routes/links are otherwise identical to web's, per parity.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
