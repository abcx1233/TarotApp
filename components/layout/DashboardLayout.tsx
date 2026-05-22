'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { TestModeBanner } from '@/components/ui/TestModeBanner'
import { TestModeContext } from '@/contexts/TestModeContext'
import { clsx } from 'clsx'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  initialTestMode: boolean
}

export function DashboardLayout({ children, title, initialTestMode }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isTestMode, setIsTestMode] = useState(initialTestMode)

  return (
    <TestModeContext.Provider value={{ isTestMode, setIsTestMode }}>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div
          className={clsx(
            'fixed inset-y-0 left-0 z-40 w-56 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 lg:z-auto',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
          {isTestMode && <TestModeBanner />}
          <TopBar onMenuClick={() => setSidebarOpen(true)} title={title} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </TestModeContext.Provider>
  )
}
