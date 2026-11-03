'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { TestModeBanner } from '@/components/ui/TestModeBanner'
import { TestModeContext } from '@/contexts/TestModeContext'
import { clsx } from 'clsx'
import { ToastProvider } from '@/contexts/ToastContext'
import { CommandPalette } from './CommandPalette'
import { KeyboardShortcuts } from './KeyboardShortcuts'

const PIN_KEY = 'reader-console-sidebar-pinned'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  initialTestMode: boolean
}

export function DashboardLayout({ children, title, initialTestMode }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isTestMode, setIsTestMode] = useState(initialTestMode)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    try {
      setPinned(localStorage.getItem(PIN_KEY) === '1')
    } catch {
      // storage unavailable — stay on hover mode
    }
  }, [])

  const togglePin = useCallback(() => {
    setPinned((p) => {
      try {
        localStorage.setItem(PIN_KEY, p ? '0' : '1')
      } catch {
        // ignore
      }
      return !p
    })
  }, [])

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  return (
    <TestModeContext.Provider value={{ isTestMode, setIsTestMode }}>
      <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div
          className={clsx(
            // Mobile: slide-in drawer. md+: a 56px icon rail whose inner panel expands over the page on hover.
            'fixed inset-y-0 left-0 z-40 w-56 transform transition-transform duration-200 ease-in-out md:relative md:z-30 md:translate-x-0 shrink-0',
            pinned ? 'md:w-56' : 'md:w-14',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} pinned={pinned} onTogglePin={togglePin} />
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
          {isTestMode && <TestModeBanner />}
          <TopBar onMenuClick={() => setSidebarOpen(true)} onOpenPalette={openPalette} title={title} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <KeyboardShortcuts onOpenPalette={openPalette} />
      </ToastProvider>
    </TestModeContext.Provider>
  )
}
