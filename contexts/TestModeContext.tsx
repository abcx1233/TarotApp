'use client'

import { createContext, useContext } from 'react'

interface TestModeContextValue {
  isTestMode: boolean
  setIsTestMode: (value: boolean) => void
}

export const TestModeContext = createContext<TestModeContextValue>({
  isTestMode: false,
  setIsTestMode: () => {},
})

export function useTestMode() {
  return useContext(TestModeContext)
}
