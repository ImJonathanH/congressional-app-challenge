/**
 * Raptor background-check integration.
 *
 * ⚠️ SIMULATED. This module mimics the request/response shape of a Raptor
 * Technologies screening call, but it does NOT contact Raptor and it does NOT
 * screen anyone. It exists so the onboarding flow is complete and demoable.
 *
 * To go live you need a Raptor account and API credentials, and the check must
 * run on a SERVER — a criminal-background API key can never ship in browser
 * code, and the results are regulated personal data (FCRA in the US: you need
 * the subject's written consent and an adverse-action process before you can
 * act on a result). Replace `submitBackgroundCheck` with a call to your own
 * backend endpoint, which then talks to Raptor.
 */

const STAGES = [
  { id: 'submitted', label: 'Submitting to Raptor', detail: 'Encrypting identity details' },
  { id: 'identity', label: 'Verifying identity', detail: 'Matching name, address, and date of birth' },
  { id: 'criminal', label: 'Screening criminal records', detail: 'National, county, and sex-offender registries' },
  { id: 'sanctions', label: 'Checking watchlists', detail: 'State and federal sanction lists' },
  { id: 'complete', label: 'Screening complete', detail: 'Compiling your verification badge' },
]

export const VERIFICATION_STAGES = STAGES

/** Fields the real API requires. Used to gate the submit button. */
export const REQUIRED_FIELDS = ['fullName', 'dateOfBirth', 'address', 'consent']

export function validateApplicant(applicant) {
  const missing = REQUIRED_FIELDS.filter((f) => !applicant?.[f])
  return { valid: missing.length === 0, missing }
}

/**
 * Runs the simulated screening.
 *
 * @param {object} applicant           Identity details collected from the parent.
 * @param {(stage, index) => void} onStage  Progress callback, fired per stage.
 * @returns {Promise<{status: string, referenceId: string, clearedAt: string, provider: string}>}
 */
export function submitBackgroundCheck(applicant, onStage) {
  const { valid, missing } = validateApplicant(applicant)
  if (!valid) {
    return Promise.reject(new Error(`Missing required fields: ${missing.join(', ')}`))
  }

  return new Promise((resolve) => {
    let i = 0
    const tick = () => {
      onStage?.(STAGES[i], i)
      i += 1
      if (i < STAGES.length) {
        setTimeout(tick, 900)
      } else {
        setTimeout(
          () =>
            resolve({
              status: 'clear',
              provider: 'Raptor Technologies (simulated)',
              referenceId: `RPTR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
              clearedAt: new Date().toISOString(),
            }),
          700,
        )
      }
    }
    tick()
  })
}
