import crypto from 'node:crypto'

/**
 * In-memory background-check store.
 *
 * Used by the tests and by local development without Firebase. The real one is
 * createFirestoreStore in firestoreStore.js — they share this interface, so
 * app.js works with either.
 *
 * Every method is async even though nothing here needs to be, so swapping in
 * the Firestore store doesn't change a single call site.
 *
 * Note what is NOT stored: no SSN, no date of birth. The candidate enters those
 * directly into Checkr's hosted form, so they never touch this server.
 */
export function createStore() {
  const checks = new Map()

  return {
    async create(fields) {
      // One check per user, keyed by uid, matching the Firestore layout.
      const id = fields.uid ?? `chk_${crypto.randomBytes(9).toString('hex')}`
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

    async get(id) {
      return checks.get(id) ?? null
    },

    async update(id, updates) {
      const existing = checks.get(id)
      if (!existing) return null
      const next = { ...existing, ...updates, updatedAt: new Date().toISOString() }
      checks.set(id, next)
      return next
    },

    /** Webhooks identify the resource by Checkr's ids, not ours. */
    async findBy({ field, value }) {
      for (const record of checks.values()) {
        if (record[field] === value) return record
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
