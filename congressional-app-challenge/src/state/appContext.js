import { createContext, useContext } from 'react'

export const AppContext = createContext(null)

/** Reads the shared TeenHands session (profile, jobs, applications). */
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
