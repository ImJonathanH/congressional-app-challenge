import crypto from 'node:crypto'

/**
 * In-memory record of background checks in flight.
 *
 * Prototype-grade on purpose: restarting the server forgets everything. A real
 * deployment needs a database, because a Checkr report can take days to finish
 * and the candidate has to be able to come back to it.
 *
 * Note what is NOT stored here: no SSN, no date of birth. The candidate enters
 * those directly into Checkr's hosted form, so they never touch this server.
 */
export function createStore() {
  const checks = new Map()

  return {
    create(fields) {
      const id = `chk_${crypto.randomBytes(9).toString('hex')}`
      const now = new Date().toISOString()
      const record = {
        id,
        status: 'awaiting_candidate',
        result: null,
        assessment: null,
        reportId: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        ...fields,
      }
      checks.set(id, record)
      return record
    },

    get: (id) => checks.get(id) ?? null,

    update(id, updates) {
      const existing = checks.get(id)
      if (!existing) return null
      const next = { ...existing, ...updates, updatedAt: new Date().toISOString() }
      checks.set(id, next)
      return next
    },

    /** Webhooks identify the resource by Checkr's ids, not ours. */
    findBy(predicate) {
      for (const record of checks.values()) {
        if (predicate(record)) return record
      }
      return null
    },
  }
}

/** The client only ever sees this projection — never candidate PII. */
export function toPublicCheck(record) {
  return {
    id: record.id,
    status: record.status,
    result: record.result,
    assessment: record.assessment,
    invitationUrl: record.invitationUrl ?? null,
    expiresAt: record.expiresAt ?? null,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
  }
}
