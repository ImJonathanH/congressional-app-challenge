/**
 * Client side of the Checkr background check.
 *
 * This file deliberately knows nothing about Checkr. It talks to the TeenHands
 * API, which holds the secret key and calls Checkr server-side — a Checkr
 * secret key in browser code would be readable by anyone who opens devtools.
 *
 * The candidate enters their SSN and date of birth on Checkr's own hosted page
 * (the `invitationUrl`), so that PII never passes through TeenHands at all.
 */

const API = '/api'

/** Statuses the UI switches on. Mirrors the server's projection. */
export const STATUS = {
  AWAITING_CANDIDATE: 'awaiting_candidate',
  PENDING: 'pending',
  COMPLETE: 'complete',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
}

/** A finished report is `clear` or `consider` — consider is not a pass. */
export const isClear = (check) => check?.status === 'complete' && check?.result === 'clear'
export const needsReview = (check) => check?.status === 'complete' && check?.result === 'consider'
export const isFinished = (check) =>
  check?.status === 'complete' || check?.status === 'expired' || check?.status === 'suspended'

export class BackgroundCheckError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'BackgroundCheckError'
    this.code = code
  }
}

async function readJson(res) {
  const text = await res.text()
  let body = {}
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      throw new BackgroundCheckError(
        'The TeenHands API returned an unreadable response. Is the server running?',
      )
    }
  }
  if (!res.ok) throw new BackgroundCheckError(body.error ?? `Request failed (${res.status})`, body.code)
  return body
}

async function call(path, options) {
  let res
  try {
    res = await fetch(`${API}${path}`, options)
  } catch {
    throw new BackgroundCheckError(
      'Could not reach the TeenHands API. Start it with `npm run server`.',
      'network',
    )
  }
  return readJson(res)
}

/** Whether the server actually has Checkr credentials, and which environment. */
export function fetchConfig() {
  return call('/config')
}

export const REQUIRED_FIELDS = ['firstName', 'lastName', 'email', 'workState']

export function validateApplicant(applicant) {
  const missing = REQUIRED_FIELDS.filter((f) => !String(applicant?.[f] ?? '').trim())
  if (!missing.includes('email') && !/^\S+@\S+\.\S+$/.test(applicant.email.trim())) {
    missing.push('email')
  }
  return { valid: missing.length === 0, missing }
}

/**
 * Creates the Checkr candidate and invitation.
 * @returns {Promise<{id: string, status: string, invitationUrl: string, expiresAt: string}>}
 */
export function startBackgroundCheck(applicant) {
  return call('/background-checks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(applicant),
  })
}

export function getBackgroundCheck(id) {
  return call(`/background-checks/${encodeURIComponent(id)}`)
}

/**
 * Polls until the report finishes.
 *
 * Real reports can take minutes to days, so this is a best-effort watcher for
 * a session that stays open — the source of truth is the server, which is also
 * updated by Checkr's webhooks.
 *
 * @returns {{promise: Promise<object>, cancel: () => void}}
 */
export function watchBackgroundCheck(id, { onUpdate, intervalMs = 4000 } = {}) {
  let cancelled = false
  let timer = null

  const promise = new Promise((resolve, reject) => {
    const tick = async () => {
      if (cancelled) return
      try {
        const check = await getBackgroundCheck(id)
        if (cancelled) return
        onUpdate?.(check)
        if (isFinished(check)) {
          resolve(check)
          return
        }
      } catch (error) {
        if (cancelled) return
        reject(error)
        return
      }
      timer = setTimeout(tick, intervalMs)
    }
    tick()
  })

  return {
    promise,
    cancel() {
      cancelled = true
      if (timer) clearTimeout(timer)
    },
  }
}
