import { PRODUCTION_BASE_URL, STAGING_BASE_URL } from './checkr.js'
import { createApp } from './app.js'
import { initFirebaseAdmin } from './firebaseAdmin.js'
import { createFirestoreStore } from './firestoreStore.js'
import { createStore } from './store.js'

const PORT = Number(process.env.PORT) || 8787
const API_KEY = process.env.CHECKR_API_KEY
const PACKAGE = process.env.CHECKR_PACKAGE || 'tasker_standard'

// Staging is the default so a stray misconfiguration can't run — and bill —
// a real screening against a real person.
const ENVIRONMENT = process.env.CHECKR_ENVIRONMENT || 'staging'
const BASE_URL =
  process.env.CHECKR_API_BASE_URL ||
  (ENVIRONMENT === 'production' ? PRODUCTION_BASE_URL : STAGING_BASE_URL)

const firebase = initFirebaseAdmin()

const app = createApp({
  apiKey: API_KEY,
  baseUrl: BASE_URL,
  packageSlug: PACKAGE,
  environment: ENVIRONMENT,
  firebaseAuth: firebase.auth,
  // Falls back to memory so the server still boots without Firebase, but
  // checks are then lost on restart.
  store: firebase.db ? createFirestoreStore(firebase.db) : createStore(),
})

app.listen(PORT, () => {
  console.log(`TeenHands API listening on http://localhost:${PORT}`)

  if (firebase.configured) {
    console.log('  Firebase: Admin SDK ready, checks stored in Firestore')
  } else {
    console.warn('  Firebase: NOT CONFIGURED — set FIREBASE_SERVICE_ACCOUNT in .env.')
    console.warn('  Requests needing sign-in will return 503; checks would be memory-only.')
  }

  if (API_KEY) {
    console.log(`  Checkr:   ${ENVIRONMENT} (${BASE_URL}), package "${PACKAGE}"`)
  } else {
    console.warn('  Checkr:   NOT CONFIGURED — set CHECKR_API_KEY in .env (see .env.example).')
  }
})
