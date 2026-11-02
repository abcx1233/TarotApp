'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  /** What is actually showing right now. */
  resolved: 'light' | 'dark'
}

const STORAGE_KEY = 'reader-console-theme'
const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  setPreference: () => {},
  resolved: 'light',
})

export function useTheme() {
  return useContext(ThemeContext)
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Runs before first paint (see the inline script in app/layout.tsx) so there's no light flash. */
export const THEME_INIT_SCRIPT = `try{var p=localStorage.getItem('${STORAGE_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')

  const apply = useCallback((p: ThemePreference) => {
    const dark = p === 'dark' || (p === 'system' && systemPrefersDark())
    document.documentElement.classList.toggle('dark', dark)
    setResolved(dark ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    let stored: ThemePreference = 'system'
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === 'light' || v === 'dark' || v === 'system') stored = v
    } catch {
      // storage unavailable — fall back to system
    }
    setPreferenceState(stored)
    apply(stored)
  }, [apply])

  // Follow the OS setting live while on "system".
  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference, apply])

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPreferenceState(p)
      try {
        localStorage.setItem(STORAGE_KEY, p)
      } catch {
        // ignore
      }
      apply(p)
    },
    [apply]
  )

  const value = useMemo(() => ({ preference, setPreference, resolved }), [preference, setPreference, resolved])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
