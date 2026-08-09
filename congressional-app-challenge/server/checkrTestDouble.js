import express from 'express'

/**
 * A stand-in for the Checkr API.
 *
 * This is NOT part of the product and is never used at runtime — it exists so
 * the real integration code in checkr.js / app.js can be exercised end to end
 * without Checkr credentials. Point CHECKR_API_BASE_URL at it and the server
 * runs its genuine request/response path against a scripted counterpart.
 *
 * It implements just enough of the API to drive the flow, and mimics Checkr's
 * conventions: Basic auth, snake_case fields, `result` of clear/consider.
 */
export function createCheckrTestDouble({ apiKey, script = {} } = {}) {
  const {
    // How many GETs before the candidate "completes" the invitation.
    pollsBeforeInvitationCompleted = 1,
    // How many GETs of the report before it completes.
    pollsBeforeReportComplete = 1,
    // Final report result: 'clear' or 'consider'.
    result = 'clear',
  } = script

  const candidates = new Map()
  const invitations = new Map()
  const reports = new Map()
  let invitationPolls = 0
  let reportPolls = 0
  let seq = 0
  const nextId = (prefix) => `${prefix}_${(++seq).toString().padStart(6, '0')}`

  const app = express()
  app.use(express.json())

  // Checkr authenticates with the secret key as the Basic-auth username.
  app.use((req, res, next) => {
    const header = req.get('Authorization') ?? ''
    const [scheme, encoded] = header.split(' ')
    if (scheme !== 'Basic' || !encoded) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const [user] = Buffer.from(encoded, 'base64').toString('utf8').split(':')
    if (apiKey && user !== apiKey) {
      return res.status(401).json({ error: 'Invalid API key' })
    }
    next()
  })

  app.post('/v1/candidates', (req, res) => {
    const { first_name, last_name, email } = req.body ?? {}
    if (!email) return res.status(400).json({ error: 'email is required' })

    const candidate = {
      id: nextId('cand'),
      object: 'candidate',
      first_name,
      last_name,
      email,
      report_ids: [],
      created_at: new Date().toISOString(),
    }
    candidates.set(candidate.id, candidate)
    res.status(201).json(candidate)
  })

  app.post('/v1/invitations', (req, res) => {
    const { candidate_id, package: pkg } = req.body ?? {}
    if (!candidates.has(candidate_id)) {
      return res.status(400).json({ error: 'candidate_id is invalid' })
    }
    if (!pkg) return res.status(400).json({ error: 'package is required' })

    const id = nextId('inv')
    const invitation = {
      id,
      object: 'invitation',
      status: 'pending',
      package: pkg,
      candidate_id,
      report_id: null,
      invitation_url: `https://apply.checkr-staging.com/${id}`,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      created_at: new Date().toISOString(),
    }
    invitations.set(id, invitation)
    res.status(201).json(invitation)
  })

  app.get('/v1/invitations/:id', (req, res) => {
    const invitation = invitations.get(req.params.id)
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' })

    // Simulate the candidate finishing Checkr's hosted form.
    if (invitation.status === 'pending' && ++invitationPolls > pollsBeforeInvitationCompleted) {
      const report = {
        id: nextId('rep'),
        object: 'report',
        status: 'pending',
        result: null,
        assessment: null,
        candidate_id: invitation.candidate_id,
        package: invitation.package,
        created_at: new Date().toISOString(),
        completed_at: null,
      }
      reports.set(report.id, report)
      invitation.status = 'completed'
      invitation.report_id = report.id
    }
    res.json(invitation)
  })

  app.get('/v1/reports/:id', (req, res) => {
    const report = reports.get(req.params.id)
    if (!report) return res.status(404).json({ error: 'Report not found' })

    if (report.status === 'pending' && ++reportPolls > pollsBeforeReportComplete) {
      report.status = 'complete'
      report.result = result
      report.completed_at = new Date().toISOString()
    }
    res.json(report)
  })

  return app
}
