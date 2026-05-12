// Tailwind v4 + thefactory-ui style bundle. `index.css` is a pure shim
// (just the two bare-specifier @imports) so PostCSS doesn't flag anything
// as "must precede other statements".
import './index.css'
// App-level rules (body / html / h1-h3 / .empty).
import './styles/app.css'
// Project-specific screen CSS — the foundations / primitives / components /
// layout / utilities CSS used to live alongside these but is now sourced
// entirely from `thefactory-ui/web/styles`.
import './styles/screens/stories.css'
import './styles/screens/story-details.css'
import './styles/screens/board.css'
import './styles/screens/docs.css'
import './styles/screens/settings.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
