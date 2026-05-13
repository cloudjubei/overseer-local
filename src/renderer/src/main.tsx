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
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
