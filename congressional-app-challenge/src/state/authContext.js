import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

/** The signed-in Firebase user, plus sign-up / sign-in / sign-out. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
