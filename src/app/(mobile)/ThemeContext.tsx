'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark'
export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: ThemeMode
  themePreference: ThemePreference
  setThemePreference: (pref: ThemePreference) => void
}

const STORAGE_KEY = 'ych-theme-preference'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  themePreference: 'system',
  setThemePreference: () => {},
})

export const useTheme = () => useContext(ThemeContext)

// ---------------------------------------------------------------------------
// Resolve system preference
// ---------------------------------------------------------------------------

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(pref: ThemePreference): ThemeMode {
  if (pref === 'system') return getSystemTheme()
  return pref
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// TODO: Sync theme preference to user profile for cross-device persistence

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'system'
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null
    return stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'system'
  })

  const [theme, setTheme] = useState<ThemeMode>(() => resolveTheme(themePreference))

  // Apply data-theme to layout root
  useEffect(() => {
    const resolved = resolveTheme(themePreference)
    setTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [themePreference])

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (themePreference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      const resolved = getSystemTheme()
      setTheme(resolved)
      document.documentElement.setAttribute('data-theme', resolved)
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [themePreference])

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setThemePreferenceState(pref)
    localStorage.setItem(STORAGE_KEY, pref)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, themePreference, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  )
}
