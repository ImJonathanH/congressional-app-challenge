import { useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase/config.js'
import { setTokenProvider } from '../services/backgroundCheck.js'
import { AuthContext } from './authContext.js'

// Lets the background-check client attach an ID token without importing Firebase.
setTokenProvider(() => auth?.currentUser?.getIdToken() ?? Promise.resolve(null))

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Starts true so guards don't bounce a signed-in user before Firebase answers.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return undefined
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  const value = useMemo(
    () => ({
      user,
      uid: user?.uid ?? null,
      loading,

      async signUp({ email, password, displayName }) {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        if (displayName) {
          await updateProfile(credential.user, { displayName })
          // updateProfile doesn't re-fire onAuthStateChanged, so publish it here.
          setUser({ ...credential.user, displayName })
        }
        return credential.user
      },

      signIn: ({ email, password }) => signInWithEmailAndPassword(auth, email, password),

      signOut: () => signOut(auth),

      /** Short-lived JWT the Express server verifies before touching Checkr. */
      getIdToken: () => auth?.currentUser?.getIdToken() ?? Promise.resolve(null),
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
