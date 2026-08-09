import crypto from 'node:crypto'

/**
 * Thin client for the Checkr API.
 *
 * Auth is HTTP Basic with the secret API key as the username and an empty
 * password. This module is server-only — a Checkr secret key must never reach
 * the browser.
 *
 * Docs: https://docs.checkr.com/
 */

export const PRODUCTION_BASE_URL = 'https://api.checkr.com/v1'
export const STAGING_BASE_URL = 'https://api.checkr-staging.com/v1'

export class CheckrError extends Error {
  constructor(message, { status, body } = {}) {
    super(message)
    this.name = 'CheckrError'
    this.status = status
    this.body = body
  }
}

export function createCheckrClient({ apiKey, baseUrl = PRODUCTION_BASE_URL, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('createCheckrClient requires an apiKey')

  const authorization = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`

  async function request(method, path, body) {
    let res
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (cause) {
      throw new CheckrError(`Could not reach Checkr (${method} ${path}): ${cause.message}`, {
        status: 502,
      })
    }

    const text = await res.text()
    let payload = {}
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        throw new CheckrError(`Checkr returned a non-JSON response (${res.status})`, {
          status: res.status,
          body: text.slice(0, 500),
        })
      }
    }

    if (!res.ok) {
      // Checkr reports validation problems as { error } or { errors: [...] }.
      const detail = payload.error ?? payload.errors?.join?.('; ') ?? res.statusText
      throw new CheckrError(`Checkr ${method} ${path} failed (${res.status}): ${detail}`, {
        status: res.status,
        body: payload,
      })
    }

    return payload
  }

  return {
    baseUrl,

    /** POST /v1/candidates — the person being screened. */
    createCandidate: (candidate) => request('POST', '/candidates', candidate),

    /**
     * POST /v1/invitations — sends the candidate a Checkr-hosted link where
     * they enter their own SSN/DOB and sign the FCRA disclosure. A report is
     * created automatically once they finish, so TeenHands never handles an SSN.
     */
    createInvitation: (invitation) => request('POST', '/invitations', invitation),

    getInvitation: (id) => request('GET', `/invitations/${encodeURIComponent(id)}`),

    getReport: (id) => request('GET', `/reports/${encodeURIComponent(id)}`),
  }
}

/**
 * Verifies the X-Checkr-Signature header: HMAC-SHA256 over the exact raw
 * request body, keyed with the account's API key.
 *
 * @param {Buffer|string} rawBody  Unparsed request body bytes.
 */
export function verifyWebhookSignature(rawBody, signature, apiKey) {
  if (!signature || !apiKey) return false

  const expected = crypto
    .createHmac('sha256', apiKey)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8'))
    .digest('hex')

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(String(signature), 'utf8')
  // timingSafeEqual throws on length mismatch, so check length separately.
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
