import express from 'express'
import { CheckrError, createCheckrClient, verifyWebhookSignature } from './checkr.js'
import { requireAuth } from './firebaseAdmin.js'
import { createStore, toPublicCheck } from './store.js'

/**
 * Builds the TeenHands API.
 *
 * Two secrets live behind this server and never reach the browser: the Checkr
 * API key, and the Firebase service-account key. Callers prove who they are
 * with a Firebase ID token, which is verified here before any check is started.
 *
 * @param {object}    options
 * @param {string=}   options.apiKey       Checkr secret key. Omit to run unconfigured.
 * @param {string=}   options.baseUrl      Checkr API base URL.
 * @param {string=}   options.packageSlug  Screening package to order.
 * @param {string=}   options.environment  Label reported to the client.
 * @param {object=}   options.store        Check store. Defaults to in-memory.
 * @param {object=}   options.firebaseAuth Admin Auth instance for token checks.
 * @param {Function=} options.fetchImpl    Injectable fetch, for tests.
 */
export function createApp({
  apiKey,
  baseUrl,
  packageSlug = 'tasker_standard',
  environment = 'staging',
  store = createStore(),
  firebaseAuth = null,
  fetchImpl,
  logger = console,
} = {}) {
  const checkr = apiKey ? createCheckrClient({ apiKey, baseUrl, fetchImpl }) : null
  const authenticate = requireAuth(firebaseAuth)
  const app = express()

  /* ---------------------------------------------------------------- */
  /* Webhook — needs the raw body to verify the HMAC, so it is mounted */
  /* before the JSON body parser. Checkr signs it; no user token here. */
  /* ---------------------------------------------------------------- */

  app.post('/api/webhooks/checkr', express.raw({ type: '*/*' }), async (req, res) => {
    if (!apiKey) return res.status(503).json({ error: 'Checkr is not configured' })

    if (!verifyWebhookSignature(req.body, req.get('X-Checkr-Signature'), apiKey)) {
      logger.warn?.('[checkr] rejected webhook with bad signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    let event
    try {
      event = JSON.parse(req.body.toString('utf8'))
    } catch {
      return res.status(400).json({ error: 'Malformed JSON' })
    }

    const object = event?.data?.object ?? {}
    logger.log?.(`[checkr] webhook ${event.type} for ${object.id}`)

    try {
      if (event.type?.startsWith('invitation.')) {
        const record = await store.findBy({ field: 'invitationId', value: object.id })
        if (record) await applyInvitation(record.id, object)
      } else if (event.type?.startsWith('report.')) {
        const record = await store.findBy({ field: 'reportId', value: object.id })
        if (record) await applyReport(record.id, object)
      }
    } catch (error) {
      logger.error?.('[checkr] webhook handling failed', error)
      // Fall through to 200: Checkr retries non-2xx, and a retry storm on a bug
      // in our own handler helps nobody. The poll path will reconcile.
    }

    res.json({ received: true })
  })

  app.use(express.json())

  /* ---------------------------------------------------------------- */
  /* Config — lets the UI explain itself when the server has no keys   */
  /* ---------------------------------------------------------------- */

  app.get('/api/config', (_req, res) => {
    res.json({
      checkrConfigured: Boolean(apiKey),
      firebaseConfigured: Boolean(firebaseAuth),
      environment,
      package: packageSlug,
    })
  })

  /* ---------------------------------------------------------------- */
  /* Start a background check                                          */
  /* ---------------------------------------------------------------- */

  app.post('/api/background-checks', authenticate, async (req, res) => {
    if (!checkr) {
      return res.status(503).json({
        error: 'Background checks are unavailable: the server has no CHECKR_API_KEY configured.',
        code: 'checkr_not_configured',
      })
    }

    const { firstName, lastName, email, zipcode, workState, workCity } = req.body ?? {}
    const missing = Object.entries({ firstName, lastName, email, workState })
      .filter(([, v]) => !String(v ?? '').trim())
      .map(([k]) => k)

    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
    }

    try {
      // One check per account. Re-running would create a second Checkr
      // candidate and bill for a second report.
      const existing = await store.get(req.uid)
      if (existing && existing.status !== 'expired') {
        return res.json(toPublicCheck(existing))
      }

      const candidate = await checkr.createCandidate({
        first_name: String(firstName).trim(),
        last_name: String(lastName).trim(),
        email: String(email).trim(),
        ...(zipcode ? { zipcode: String(zipcode).trim() } : {}),
      })

      const invitation = await checkr.createInvitation({
        candidate_id: candidate.id,
        package: packageSlug,
        work_locations: [
          {
            country: 'US',
            state: String(workState).trim().toUpperCase(),
            ...(workCity ? { city: String(workCity).trim() } : {}),
          },
        ],
      })

      const record = await store.create({
        uid: req.uid,
        candidateId: candidate.id,
        invitationId: invitation.id,
        invitationUrl: invitation.invitation_url,
        expiresAt: invitation.expires_at ?? null,
        reportId: invitation.report_id ?? null,
        status: invitation.status === 'completed' ? 'pending' : 'awaiting_candidate',
      })

      logger.log?.(`[checkr] created check for ${req.uid} (candidate ${candidate.id})`)
      res.status(201).json(toPublicCheck(record))
    } catch (error) {
      respondWithError(res, error)
    }
  })

  /* ---------------------------------------------------------------- */
  /* Poll a background check                                           */
  /* ---------------------------------------------------------------- */

  app.get('/api/background-checks/:id', authenticate, async (req, res) => {
    const record = await store.get(req.params.id)
    if (!record) return res.status(404).json({ error: 'No such background check' })

    // A check belongs to exactly one account. Without this, any signed-in user
    // could read anyone else's screening result by guessing an id.
    if (record.uid && record.uid !== req.uid) {
      return res.status(404).json({ error: 'No such background check' })
    }

    if (!checkr) return res.json(toPublicCheck(record))

    // Webhooks keep this fresh in production, but they need a public URL, so
    // the client also polls. Re-reading Checkr makes local dev work either way.
    try {
      let current = record

      if (!current.reportId && current.status === 'awaiting_candidate') {
        const invitation = await checkr.getInvitation(current.invitationId)
        current = (await applyInvitation(current.id, invitation)) ?? current
      }

      if (current.reportId && current.status !== 'complete') {
        const report = await checkr.getReport(current.reportId)
        current = (await applyReport(current.id, report)) ?? current
      }

      res.json(toPublicCheck(current))
    } catch (error) {
      respondWithError(res, error)
    }
  })

  /* ---------------------------------------------------------------- */
  /* Helpers                                                           */
  /* ---------------------------------------------------------------- */

  /** Maps a Checkr invitation onto our record. */
  async function applyInvitation(checkId, invitation) {
    const updates = {}

    if (invitation.report_id) {
      updates.reportId = invitation.report_id
      updates.status = 'pending'
    }
    if (invitation.status === 'expired') updates.status = 'expired'
    if (invitation.invitation_url) updates.invitationUrl = invitation.invitation_url

    return Object.keys(updates).length ? store.update(checkId, updates) : store.get(checkId)
  }

  /**
   * Maps a Checkr report onto our record.
   *
   * `result` matters as much as `status`: a completed report is "clear" or
   * "consider", and consider means a human has to look at it — never a pass.
   */
  function applyReport(checkId, report) {
    return store.update(checkId, {
      reportId: report.id,
      status: report.status ?? 'pending',
      result: report.result ?? null,
      assessment: report.assessment ?? null,
      completedAt: report.completed_at ?? null,
    })
  }

  function respondWithError(res, error) {
    if (error instanceof CheckrError) {
      logger.error?.(`[checkr] ${error.message}`)
      // 4xx from Checkr usually means our request was wrong, not the user's.
      const status = error.status >= 500 || error.status === 502 ? 502 : 400
      return res.status(status).json({ error: error.message })
    }
    logger.error?.('[server] unexpected error', error)
    res.status(500).json({ error: 'Unexpected server error' })
  }

  return app
}
