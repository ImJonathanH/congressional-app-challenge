import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Firebase Admin SDK setup — server only.
 *
 * The Admin SDK bypasses firestore.rules entirely, so the service-account key
 * is a real secret. It belongs in .env (which is gitignored) and must never be
 * committed or shipped to the browser.
 *
 * Credentials are read from, in order:
 *   1. FIREBASE_SERVICE_ACCOUNT       the JSON key, inline
 *   2. GOOGLE_APPLICATION_CREDENTIALS a path to the JSON key file
 *   3. FIRESTORE_EMULATOR_HOST        the local emulator, no key needed
 */
export function initFirebaseAdmin({
  serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT,
  credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId = process.env.FIREBASE_PROJECT_ID,
  emulatorHost = process.env.FIRESTORE_EMULATOR_HOST,
} = {}) {
  const usable = serviceAccountJson || credentialsPath || emulatorHost
  if (!usable) return { configured: false, auth: null, db: null }

  try {
    const app =
      getApps()[0] ??
      initializeApp(
        serviceAccountJson
          ? { credential: cert(JSON.parse(serviceAccountJson)) }
          : // The SDK picks up GOOGLE_APPLICATION_CREDENTIALS or the emulator
            // on its own; it only needs to be told the project.
            { projectId },
      )

    return { configured: true, auth: getAuth(app), db: getFirestore(app) }
  } catch (error) {
    console.error('[firebase] admin init failed:', error.message)
    return { configured: false, auth: null, db: null }
  }
}

/**
 * Express middleware: requires a valid Firebase ID token and puts the caller's
 * uid on `req.uid`.
 *
 * @param {{verifyIdToken: (token: string) => Promise<{uid: string}>}|null} auth
 */
export function requireAuth(auth) {
  return async (req, res, next) => {
    if (!auth) {
      return res.status(503).json({
        error: 'Sign-in is unavailable: the server has no Firebase credentials configured.',
        code: 'auth_not_configured',
      })
    }

    const header = req.get('Authorization') ?? ''
    const [scheme, token] = header.split(' ')
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Sign in to continue.', code: 'unauthenticated' })
    }

    try {
      const decoded = await auth.verifyIdToken(token)
      req.uid = decoded.uid
      next()
    } catch {
      return res.status(401).json({ error: 'Your session expired. Sign in again.', code: 'unauthenticated' })
    }
  }
}
