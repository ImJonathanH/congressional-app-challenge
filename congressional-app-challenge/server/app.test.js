import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { after, describe, it } from 'node:test'
import { createApp } from './app.js'
import { createCheckrTestDouble } from './checkrTestDouble.js'
import { verifyWebhookSignature } from './checkr.js'

const API_KEY = 'test_key_abc123'
const servers = []

/** Stands in for Firebase Admin: "id-token-for-<uid>" authenticates as <uid>. */
const fakeFirebaseAuth = {
  async verifyIdToken(token) {
    const match = /^id-token-for-(.+)$/.exec(token)
    if (!match) throw new Error('invalid token')
    return { uid: match[1] }
  },
}

const asUser = (uid) => ({ Authorization: `Bearer id-token-for-${uid}` })

/** Boots an HTTP server on an ephemeral port and returns its base URL. */
function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      servers.push(server)
      resolve(`http://127.0.0.1:${server.address().port}`)
    })
  })
}

/** Boots a test-double Checkr plus a TeenHands API pointed at it. */
async function boot(script) {
  const checkrUrl = await listen(createCheckrTestDouble({ apiKey: API_KEY, script }))
  const appUrl = await listen(
    createApp({
      apiKey: API_KEY,
      baseUrl: `${checkrUrl}/v1`,
      packageSlug: 'tasker_standard',
      firebaseAuth: fakeFirebaseAuth,
      logger: {},
    }),
  )
  return appUrl
}

const json = async (res) => ({ status: res.status, body: await res.json() })

const start = (baseUrl, overrides = {}, uid = 'user_1') =>
  fetch(`${baseUrl}/api/background-checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...asUser(uid) },
    body: JSON.stringify({
      firstName: 'Jordan',
      lastName: 'Alvarez',
      email: 'jordan@example.com',
      workCity: 'Mountain View',
      workState: 'ca',
      ...overrides,
    }),
  })

after(() => servers.forEach((s) => s.close()))

describe('POST /api/background-checks', () => {
  it('creates a Checkr candidate and invitation, and returns the hosted link', async () => {
    const url = await boot()
    const { status, body } = await json(await start(url))

    assert.equal(status, 201)
    assert.equal(body.status, 'awaiting_candidate')
    // One check per account, so the record is keyed by the caller's uid.
    assert.equal(body.id, 'user_1')
    assert.match(body.invitationUrl, /^https:\/\/apply\.checkr-staging\.com\//)
    assert.ok(body.expiresAt)
  })

  it('never returns candidate PII to the client', async () => {
    const url = await boot()
    const { body } = await json(await start(url))
    const serialized = JSON.stringify(body)

    for (const leak of ['Jordan', 'Alvarez', 'jordan@example.com', 'cand_']) {
      assert.ok(!serialized.includes(leak), `response leaked ${leak}`)
    }
  })

  it('rejects incomplete applicants before calling Checkr', async () => {
    const url = await boot()
    const { status, body } = await json(await start(url, { email: '', workState: '' }))

    assert.equal(status, 400)
    assert.match(body.error, /email/)
    assert.match(body.error, /workState/)
  })

  it('returns 503 when the server has no Checkr key', async () => {
    const url = await listen(createApp({ firebaseAuth: fakeFirebaseAuth, logger: {} }))
    const { status, body } = await json(await start(url))

    assert.equal(status, 503)
    assert.equal(body.code, 'checkr_not_configured')
  })

  it('surfaces a Checkr rejection instead of pretending it worked', async () => {
    // Wrong key on our side: the double answers 401, as Checkr would.
    const checkrUrl = await listen(createCheckrTestDouble({ apiKey: 'a_different_key' }))
    const url = await listen(
      createApp({
        apiKey: API_KEY,
        baseUrl: `${checkrUrl}/v1`,
        firebaseAuth: fakeFirebaseAuth,
        logger: {},
      }),
    )
    const { status, body } = await json(await start(url))

    assert.equal(status, 400)
    assert.match(body.error, /Invalid API key/)
  })
})

describe('GET /api/background-checks/:id', () => {
  it('walks awaiting_candidate → pending → complete/clear', async () => {
    const url = await boot({ pollsBeforeInvitationCompleted: 1, pollsBeforeReportComplete: 1 })
    const { body: created } = await json(await start(url))
    assert.equal(created.status, 'awaiting_candidate')

    const poll = async () =>
      (await json(await fetch(`${url}/api/background-checks/${created.id}`, { headers: asUser('user_1') })))
        .body

    // First poll: candidate still hasn't opened the Checkr link.
    assert.equal((await poll()).status, 'awaiting_candidate')

    // Second: invitation completed, report created and running.
    const running = await poll()
    assert.equal(running.status, 'pending')
    assert.equal(running.result, null)

    // Third: report done.
    const done = await poll()
    assert.equal(done.status, 'complete')
    assert.equal(done.result, 'clear')
    assert.ok(done.completedAt)
  })

  it('reports a consider result as consider, not as a pass', async () => {
    const url = await boot({
      pollsBeforeInvitationCompleted: 0,
      pollsBeforeReportComplete: 0,
      result: 'consider',
    })
    const { body: created } = await json(await start(url))

    let latest
    for (let i = 0; i < 5; i += 1) {
      latest = (
        await json(await fetch(`${url}/api/background-checks/${created.id}`, { headers: asUser('user_1') }))
      ).body
      if (latest.status === 'complete') break
    }

    assert.equal(latest.status, 'complete')
    assert.equal(latest.result, 'consider')
    assert.notEqual(latest.result, 'clear')
  })

  it('404s on an unknown id', async () => {
    const url = await boot()
    const { status } = await json(
      await fetch(`${url}/api/background-checks/chk_nope`, { headers: asUser('user_1') }),
    )
    assert.equal(status, 404)
  })
})

describe('authentication', () => {
  it('refuses to start a check without a valid Firebase token', async () => {
    const url = await boot()

    const noHeader = await fetch(`${url}/api/background-checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    assert.equal(noHeader.status, 401)

    const badToken = await fetch(`${url}/api/background-checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer forged' },
      body: '{}',
    })
    assert.equal(badToken.status, 401)
  })

  it('will not let one user read another user’s screening result', async () => {
    const url = await boot()
    const { body: mine } = await json(await start(url, {}, 'user_1'))

    const asSomeoneElse = await json(
      await fetch(`${url}/api/background-checks/${mine.id}`, { headers: asUser('user_2') }),
    )
    // 404 rather than 403, so an id can't be confirmed to exist by probing.
    assert.equal(asSomeoneElse.status, 404)

    const asOwner = await json(
      await fetch(`${url}/api/background-checks/${mine.id}`, { headers: asUser('user_1') }),
    )
    assert.equal(asOwner.status, 200)
  })

  it('does not re-run a check the account already has', async () => {
    const url = await boot({ pollsBeforeInvitationCompleted: 999 })
    const first = await json(await start(url))
    const second = await json(await start(url))

    assert.equal(first.status, 201)
    assert.equal(second.status, 200) // returned the existing one
    assert.equal(second.body.id, first.body.id)
    assert.equal(second.body.invitationUrl, first.body.invitationUrl)
  })

  it('returns 503 when the server has no Firebase credentials', async () => {
    const url = await listen(createApp({ apiKey: API_KEY, logger: {} }))
    const { status, body } = await json(await start(url))

    assert.equal(status, 503)
    assert.equal(body.code, 'auth_not_configured')
  })
})

describe('POST /api/webhooks/checkr', () => {
  const send = (url, event, signature) =>
    fetch(`${url}/api/webhooks/checkr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'X-Checkr-Signature': signature } : {}),
      },
      body: JSON.stringify(event),
    })

  const sign = (payload) =>
    crypto.createHmac('sha256', API_KEY).update(JSON.stringify(payload)).digest('hex')

  it('rejects an unsigned or wrongly signed payload', async () => {
    const url = await boot()
    const event = { type: 'report.completed', data: { object: { id: 'rep_1' } } }

    assert.equal((await send(url, event)).status, 401)
    assert.equal((await send(url, event, 'deadbeef')).status, 401)
    assert.equal((await send(url, event, sign({ different: 'payload' }))).status, 401)
  })

  it('applies a correctly signed report.completed without any polling', async () => {
    // Never let polling advance the state, so only the webhook can.
    const url = await boot({ pollsBeforeInvitationCompleted: 999, pollsBeforeReportComplete: 999 })
    const { body: created } = await json(await start(url))

    // Link a report id to this check the way invitation.completed would.
    const invitationEvent = {
      type: 'invitation.completed',
      data: { object: { id: 'inv_000002', status: 'completed', report_id: 'rep_webhook' } },
    }
    assert.equal((await send(url, invitationEvent, sign(invitationEvent))).status, 200)

    const reportEvent = {
      type: 'report.completed',
      data: {
        object: {
          id: 'rep_webhook',
          status: 'complete',
          result: 'clear',
          completed_at: '2026-08-09T12:00:00Z',
        },
      },
    }
    assert.equal((await send(url, reportEvent, sign(reportEvent))).status, 200)

    const { body } = await json(
      await fetch(`${url}/api/background-checks/${created.id}`, { headers: asUser('user_1') }),
    )
    assert.equal(body.status, 'complete')
    assert.equal(body.result, 'clear')
  })
})

describe('verifyWebhookSignature', () => {
  it('accepts a matching HMAC-SHA256 and rejects tampering', () => {
    const body = Buffer.from('{"type":"report.completed"}')
    const good = crypto.createHmac('sha256', API_KEY).update(body).digest('hex')

    assert.equal(verifyWebhookSignature(body, good, API_KEY), true)
    assert.equal(verifyWebhookSignature(body, good, 'wrong_key'), false)
    assert.equal(verifyWebhookSignature(Buffer.from('{"tampered":true}'), good, API_KEY), false)
    assert.equal(verifyWebhookSignature(body, '', API_KEY), false)
    assert.equal(verifyWebhookSignature(body, good, undefined), false)
  })
})

describe('GET /api/config', () => {
  it('tells the client whether verification is available', async () => {
    const configured = await json(await fetch(`${await boot()}/api/config`))
    assert.equal(configured.body.checkrConfigured, true)

    const bare = await json(await fetch(`${await listen(createApp({ logger: {} }))}/api/config`))
    assert.equal(bare.body.checkrConfigured, false)
    assert.equal(bare.body.firebaseConfigured, false)
  })
})
