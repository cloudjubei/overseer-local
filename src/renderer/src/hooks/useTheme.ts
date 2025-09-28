import { useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function getSavedTheme(): Theme {
  const v = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
  return v === 'dark' || v === 'light' ? v : 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  // Use data-theme attribute (design tokens listen to [data-theme="dark"]) and set .dark class for compatibility
  html.setAttribute('data-theme', theme)
  if (theme === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getSavedTheme())

  const availableThemes: Theme[] = ['light', 'dark']

  const initTheme = () => {
    const theme = getSavedTheme()
    applyTheme(theme)
    setThemeState(theme)
  }

  const setTheme = (theme: Theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, theme)
    }
    applyTheme(theme)
    setThemeState(theme)
  }

  return { initTheme, availableThemes, theme, setTheme }
}
