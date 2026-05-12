// Local styles — imported as JS so each file is its own CSS module and
// PostCSS doesn't see them as inlined into a parent `index.css` with the
// Tailwind / package @imports at the bottom (which would flag every local
// @import as "must precede other statements").
import './styles/design-tokens.css'
import './styles/foundations/metrics.css'
import './styles/primitives/effects.css'
import './styles/components/buttons.css'
import './styles/components/forms.css'
import './styles/components/feedback.css'
import './styles/components/badges.css'
import './styles/components/tooltip.css'
import './styles/components/overlays.css'
import './styles/components/cards.css'
import './styles/components/segmented.css'
import './styles/components/file-display.css'
import './styles/components/file-mentions.css'
import './styles/components/chat.css'
import './styles/components/standard-picker.css'
import './styles/layout/nav.css'
import './styles/screens/stories.css'
import './styles/screens/story-details.css'
import './styles/screens/board.css'
import './styles/screens/docs.css'
import './styles/screens/settings.css'
import './styles/utilities/semantic-utilities.css'
// Tailwind v4 + package bundle. `index.css` contains only the two
// bare-specifier @imports — no other CSS rules — so PostCSS doesn't flag
// them as "must precede other statements".
import './index.css'
// App-level rules (body / html / h1-h3 / .empty) — kept out of `index.css`
// so the file stays a pure @import shim.
import './styles/app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
