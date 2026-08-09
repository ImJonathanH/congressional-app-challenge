import { PRODUCTION_BASE_URL, STAGING_BASE_URL } from './checkr.js'
import { createApp } from './app.js'

const PORT = Number(process.env.PORT) || 8787
const API_KEY = process.env.CHECKR_API_KEY
const PACKAGE = process.env.CHECKR_PACKAGE || 'tasker_standard'

// Staging is the default so a stray misconfiguration can't run — and bill —
// a real screening against a real person.
const ENVIRONMENT = process.env.CHECKR_ENVIRONMENT || 'staging'
const BASE_URL =
  process.env.CHECKR_API_BASE_URL ||
  (ENVIRONMENT === 'production' ? PRODUCTION_BASE_URL : STAGING_BASE_URL)

const app = createApp({
  apiKey: API_KEY,
  baseUrl: BASE_URL,
  packageSlug: PACKAGE,
  environment: ENVIRONMENT,
})

app.listen(PORT, () => {
  console.log(`TeenHands API listening on http://localhost:${PORT}`)
  if (API_KEY) {
    console.log(`  Checkr: ${ENVIRONMENT} (${BASE_URL}), package "${PACKAGE}"`)
  } else {
    console.warn('  Checkr: NOT CONFIGURED — set CHECKR_API_KEY in .env (see .env.example).')
    console.warn('  Verification requests will return 503 until you do.')
  }
})
