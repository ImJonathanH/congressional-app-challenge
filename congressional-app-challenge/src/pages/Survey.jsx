import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { useApp } from '../state/appContext.js'
import { useAuth } from '../state/authContext.js'
import { friendlyAuthError } from '../state/authErrors.js'
import { createProfile, saveProfile } from '../services/db.js'
import { PARENT_PRIORITIES, SERVICES, WEEKDAYS } from '../data/services.js'
import {
  fetchConfig,
  isClear,
  isFinished,
  needsReview,
  startBackgroundCheck,
  validateApplicant,
  watchBackgroundCheck,
} from '../services/backgroundCheck.js'
import './Survey.css'

const ZIP_RE = /^\d{5}$/

/**
 * Ordered step ids per role, used for the progress bar. The account step is
 * dropped for anyone already signed in.
 */
const FLOW = {
  none: ['zip', 'role'],
  parent: ['zip', 'role', 'account', 'priorities', 'verify'],
  teen: ['zip', 'role', 'account', 'teen-setup'],
}

const flowFor = (role, signedIn) =>
  (FLOW[role ?? 'none'] ?? FLOW.none).filter((s) => !(signedIn && s === 'account'))

export default function Survey() {
  const navigate = useNavigate()
  const app = useApp()
  const { uid, loading: authLoading } = useAuth()

  const [step, setStep] = useState('zip')
  const [zip, setZipLocal] = useState(app.zip)
  const [zipError, setZipError] = useState('')
  const [role, setRoleLocal] = useState(app.role)
  const [priorities, setPrioritiesLocal] = useState(app.priorities)
  // Set once the background check starts — you can't back out mid-screening.
  const [locked, setLocked] = useState(false)

  const flow = flowFor(role, Boolean(uid))
  const stepIndex = Math.max(flow.indexOf(step), 0)
  const progress = ((stepIndex + 1) / flow.length) * 100

  // A returning user's profile arrives from Firestore a moment after auth does.
  // Pick up where they left off rather than restarting the survey.
  useEffect(() => {
    if (!uid || app.loading || !app.profile) return
    if (app.role === 'parent' && app.verification?.result === 'clear') {
      navigate('/parent', { replace: true })
    } else if (app.role === 'teen' && app.teenProfile) {
      navigate('/teen', { replace: true })
    } else {
      if (app.zip) setZipLocal(app.zip)
      if (app.role) {
        setRoleLocal(app.role)
        setStep((current) =>
          current === 'zip' || current === 'role'
            ? app.role === 'parent'
              ? 'priorities'
              : 'teen-setup'
            : current,
        )
      }
    }
  }, [uid, app.loading, app.profile, app.role, app.zip, app.teenProfile, app.verification, navigate])

  if (authLoading || (uid && app.loading)) {
    return (
      <div className="page-spinner">
        <span className="verify-spinner" aria-label="Loading" />
      </div>
    )
  }

  const goBack = () => {
    const prev = flow[stepIndex - 1]
    if (prev) setStep(prev)
    else navigate('/')
  }

  const submitZip = (e) => {
    e.preventDefault()
    if (!ZIP_RE.test(zip.trim())) {
      setZipError('Enter a 5-digit ZIP code so we can find people nearby.')
      return
    }
    setZipError('')
    if (uid) app.setZip(zip.trim())
    setStep('role')
  }

  const chooseRole = (nextRole) => {
    setRoleLocal(nextRole)
    // Without an account there is nowhere to save this yet, so collect it
    // locally and write both fields once the account exists.
    if (uid) {
      app.setRole(nextRole)
      setStep(nextRole === 'parent' ? 'priorities' : 'teen-setup')
    } else {
      setStep('account')
    }
  }

  const onAccountCreated = () =>
    setStep(role === 'parent' ? 'priorities' : 'teen-setup')

  const togglePriority = (id) =>
    setPrioritiesLocal((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const finishPriorities = (selected) => {
    app.setPriorities(selected)
    setStep('verify')
  }

  return (
    <div className="survey">
      <header className="survey-top">
        <div className="shell survey-top-inner">
          <Logo to="/" size="sm" />
          <span className="survey-count">
            Step {stepIndex + 1} of {flow.length}
          </span>
        </div>
        <div className="survey-progress" role="progressbar" aria-valuenow={Math.round(progress)}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="survey-main">
        <div className="survey-panel">
          {step !== 'zip' && !locked && (
            <button type="button" className="btn btn-quiet btn-sm survey-back" onClick={goBack}>
              ← Back
            </button>
          )}

          {step === 'zip' && (
            <form onSubmit={submitZip} className="survey-step">
              <h1 className="survey-q">What&apos;s your ZIP code?</h1>
              <p className="survey-help">
                TeenHands is hyper-local. We use your ZIP to show only the families and teens who
                are a short walk or drive away.
              </p>
              <label className="field survey-zip-field">
                <span className="sr-only">ZIP code</span>
                <input
                  className="input survey-zip"
                  value={zip}
                  onChange={(e) => setZipLocal(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="94040"
                  inputMode="numeric"
                  autoFocus
                  aria-invalid={Boolean(zipError)}
                />
              </label>
              {zipError && <p className="survey-error">{zipError}</p>}
              <button type="submit" className="btn btn-primary btn-lg survey-next">
                Continue
              </button>
            </form>
          )}

          {step === 'role' && (
            <div className="survey-step">
              <h1 className="survey-q">Which one are you?</h1>
              <p className="survey-help">
                This decides what your dashboard looks like. You can make the other kind of account
                later.
              </p>
              <div className="role-grid">
                <button
                  type="button"
                  className={`role-card${role === 'parent' ? ' is-selected' : ''}`}
                  onClick={() => chooseRole('parent')}
                >
                  <span className="role-emoji" aria-hidden="true">
                    👨‍👩‍👧
                  </span>
                  <span className="role-title">I&apos;m a parent</span>
                  <span className="role-body">
                    Find and hire a verified teen nearby, or post a job and let them come to you.
                  </span>
                  <span className="role-note">Requires a background check</span>
                </button>

                <button
                  type="button"
                  className={`role-card${role === 'teen' ? ' is-selected' : ''}`}
                  onClick={() => chooseRole('teen')}
                >
                  <span className="role-emoji" aria-hidden="true">
                    🎒
                  </span>
                  <span className="role-title">I&apos;m a teen</span>
                  <span className="role-body">
                    Set how far you&apos;ll travel, list what you do, and apply to jobs on your
                    street.
                  </span>
                  <span className="role-note">Always free</span>
                </button>
              </div>
            </div>
          )}

          {step === 'priorities' && (
            <div className="survey-step">
              <h1 className="survey-q">What matters most to you?</h1>
              <p className="survey-help">
                Pick as many as you like — we&apos;ll sort your matches around them. You can skip
                this and change it anytime.
              </p>
              <div className="priority-grid">
                {PARENT_PRIORITIES.map((p) => {
                  const on = priorities.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`priority-chip${on ? ' is-on' : ''}`}
                      onClick={() => togglePriority(p.id)}
                      aria-pressed={on}
                    >
                      <span className="priority-box" aria-hidden="true">
                        {on ? '✓' : ''}
                      </span>
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <div className="survey-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => finishPriorities(priorities)}
                >
                  Continue
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-lg"
                  onClick={() => finishPriorities([])}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {step === 'account' && (
            <AccountStep zip={zip} role={role} onDone={onAccountCreated} />
          )}

          {step === 'verify' && (
            <VerifyStep onStart={() => setLocked(true)} onDone={() => navigate('/parent')} />
          )}

          {step === 'teen-setup' && <TeenSetupStep onDone={() => navigate('/teen')} />}
        </div>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Account creation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Creates the Firebase Auth user, then writes the ZIP and role that were
 * collected in the previous two steps. Both writes go to users/{uid}, which
 * only this account can read or write (see firestore.rules).
 */
function AccountStep({ zip, role, onDone }) {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ displayName: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const ready = form.displayName.trim() && form.email.trim() && form.password.length >= 6

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user = await signUp(form)
      await createProfile(user.uid, { email: form.email.trim(), displayName: form.displayName.trim() })
      await saveProfile(user.uid, { zip, role })
      onDone()
    } catch (err) {
      setError(friendlyAuthError(err))
      setBusy(false)
    }
  }

  return (
    <form className="survey-step" onSubmit={submit}>
      <span className="survey-badge">Create your account</span>
      <h1 className="survey-q">Save your spot</h1>
      <p className="survey-help">
        An account keeps your {role === 'parent' ? 'jobs and matches' : 'listing and applications'}{' '}
        in one place, and lets people reach you.
      </p>

      <label className="field auth-field">
        <span className="field-label">
          {role === 'parent' ? 'Your name' : 'First name and last initial'}
        </span>
        <input
          className="input"
          value={form.displayName}
          onChange={set('displayName')}
          placeholder={role === 'parent' ? 'Jordan Alvarez' : 'Maya R.'}
          autoComplete="name"
          autoFocus
        />
      </label>

      <label className="field auth-field">
        <span className="field-label">Email</span>
        <input
          className="input"
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>

      <label className="field auth-field">
        <span className="field-label">Password</span>
        <input
          className="input"
          type="password"
          value={form.password}
          onChange={set('password')}
          autoComplete="new-password"
        />
        <span className="survey-hint">At least 6 characters.</span>
      </label>

      {error && <p className="survey-error">{error}</p>}

      <button type="submit" className="btn btn-primary btn-lg survey-next" disabled={!ready || busy}>
        {busy ? 'Creating your account…' : 'Create account'}
      </button>

      <p className="survey-hint">
        Already have one? <Link to="/signin">Sign in</Link>.
      </p>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Parent verification                                                 */
/* ------------------------------------------------------------------ */

function VerifyStep({ onStart, onDone }) {
  const app = useApp()
  const [applicant, setApplicant] = useState({
    firstName: '',
    lastName: '',
    email: '',
    workCity: '',
    workState: '',
  })
  // form | starting | awaiting_candidate | pending | complete | error
  const [phase, setPhase] = useState('form')
  const [check, setCheck] = useState(app.verification)
  const [error, setError] = useState(null)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig({ checkrConfigured: false, unreachable: true }))
  }, [])

  // Watch the check until Checkr finishes the report.
  useEffect(() => {
    if (!check?.id || isFinished(check)) return undefined

    const watcher = watchBackgroundCheck(check.id, {
      onUpdate: (next) => {
        setCheck(next)
        setPhase(isFinished(next) ? 'complete' : next.status)
        // The authoritative record is written to Firestore by the server;
        // this local copy just drives the screen while the tab is open.
      },
    })
    watcher.promise.catch((e) => {
      setError(e.message)
      setPhase('error')
    })
    return watcher.cancel
    // Re-subscribe only when the check identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check?.id])

  const { valid } = validateApplicant(applicant)
  const set = (key) => (e) => setApplicant((a) => ({ ...a, [key]: e.target.value }))

  const run = async (e) => {
    e.preventDefault()
    setError(null)
    setPhase('starting')
    onStart?.()
    try {
      const started = await startBackgroundCheck(applicant)
      setCheck(started)
      setPhase(started.status)
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  /* ---------- Finished ---------- */

  if (phase === 'complete' && check) {
    if (isClear(check)) {
      return (
        <div className="survey-step verify-done">
          <span className="verify-check" aria-hidden="true">
            ✓
          </span>
          <h1 className="survey-q">You&apos;re verified</h1>
          <p className="survey-help">
            Checkr returned a clear report. Teens will see a verified badge on your family profile.
          </p>
          <dl className="verify-receipt card">
            <div>
              <dt>Result</dt>
              <dd className="verify-clear">Clear</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{check.id}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>Checkr</dd>
            </div>
          </dl>
          <button type="button" className="btn btn-primary btn-lg survey-next" onClick={onDone}>
            Go to my dashboard →
          </button>
        </div>
      )
    }

    // "Consider", "suspended" and "expired" all stop here. A consider result
    // is a human decision under FCRA, never an automatic rejection or pass.
    return (
      <div className="survey-step verify-done">
        <span className="verify-check verify-check-review" aria-hidden="true">
          !
        </span>
        <h1 className="survey-q">
          {needsReview(check) ? 'Your report needs a review' : 'We couldn’t finish your check'}
        </h1>
        <p className="survey-help">
          {needsReview(check)
            ? 'Checkr flagged something on your report for a person to look at. Our team reviews these by hand and will email you — a flag is not a rejection, and you have the right to dispute anything inaccurate.'
            : check.status === 'expired'
              ? 'Your Checkr invitation expired before it was completed. Start again to get a new link.'
              : 'Checkr suspended this report, usually because some information was missing. Our team will email you.'}
        </p>
        <dl className="verify-receipt card">
          <div>
            <dt>Result</dt>
            <dd>{check.result ?? check.status}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{check.id}</dd>
          </div>
        </dl>
        <p className="survey-hint">
          Your dashboard unlocks once the review clears. You can close this page.
        </p>
      </div>
    )
  }

  /* ---------- Waiting on Checkr ---------- */

  if (phase === 'awaiting_candidate' && check) {
    return (
      <div className="survey-step">
        <span className="survey-badge">Almost done</span>
        <h1 className="survey-q">Finish your check with Checkr</h1>
        <p className="survey-help">
          Checkr collects your SSN and date of birth on their own secure page and handles the
          consent forms the law requires. TeenHands never sees them.
        </p>

        <a
          className="btn btn-primary btn-lg"
          href={check.invitationUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Checkr →
        </a>

        <div className="verify-waiting card">
          <span className="verify-spinner" aria-hidden="true" />
          <span>
            <span className="verify-stage-label">Waiting for you to finish</span>
            <span className="verify-stage-detail">
              This page updates on its own once Checkr has your information.
            </span>
          </span>
        </div>

        {check.expiresAt && (
          <p className="survey-hint">
            Your link expires {new Date(check.expiresAt).toLocaleDateString()}.
          </p>
        )}
      </div>
    )
  }

  if (phase === 'pending' || phase === 'starting') {
    return (
      <div className="survey-step">
        <h1 className="survey-q">
          {phase === 'starting' ? 'Setting up your check' : 'Checkr is running your report'}
        </h1>
        <p className="survey-help">
          {phase === 'starting'
            ? 'One moment.'
            : 'Most reports come back within a few minutes, but some county searches take longer. You can leave this page — we’ll email you.'}
        </p>
        <div className="verify-waiting card">
          <span className="verify-spinner" aria-hidden="true" />
          <span>
            <span className="verify-stage-label">
              {phase === 'starting' ? 'Creating your Checkr candidate' : 'Report in progress'}
            </span>
            <span className="verify-stage-detail">
              SSN trace · national criminal search · sex-offender registry · county records
            </span>
          </span>
        </div>
      </div>
    )
  }

  /* ---------- Form ---------- */

  return (
    <form className="survey-step" onSubmit={run}>
      <span className="survey-badge">Required for parents</span>
      <h1 className="survey-q">Verify your identity</h1>
      <p className="survey-help">
        Every parent is screened through Checkr before they can message a teen. Teens are trusting
        you with their time and safety — this is the part that earns it.
      </p>

      <div className="form-grid">
        <label className="field">
          <span className="field-label">First name</span>
          <input
            className="input"
            value={applicant.firstName}
            onChange={set('firstName')}
            placeholder="Jordan"
            autoComplete="given-name"
          />
        </label>
        <label className="field">
          <span className="field-label">Last name</span>
          <input
            className="input"
            value={applicant.lastName}
            onChange={set('lastName')}
            placeholder="Alvarez"
            autoComplete="family-name"
          />
        </label>
        <label className="field form-full">
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            value={applicant.email}
            onChange={set('email')}
            placeholder="jordan@example.com"
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span className="field-label">City</span>
          <input
            className="input"
            value={applicant.workCity}
            onChange={set('workCity')}
            placeholder="Mountain View"
            autoComplete="address-level2"
          />
        </label>
        <label className="field">
          <span className="field-label">State</span>
          <input
            className="input"
            value={applicant.workState}
            onChange={(e) => setApplicant((a) => ({ ...a, workState: e.target.value.toUpperCase() }))}
            placeholder="CA"
            maxLength={2}
            autoComplete="address-level1"
          />
        </label>
      </div>

      <p className="survey-disclaimer">
        We don&apos;t ask for your SSN. Checkr collects it directly on the next screen, along with
        the disclosure and authorization the Fair Credit Reporting Act requires.
      </p>

      {config && !config.checkrConfigured && (
        <p className="survey-error">
          {config.unreachable
            ? 'The TeenHands API isn’t running. Start it with `npm run server`.'
            : 'This server has no Checkr API key configured, so verification is unavailable. See the README.'}
        </p>
      )}

      {phase === 'error' && error && <p className="survey-error">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary btn-lg survey-next"
        disabled={!valid || config?.checkrConfigured === false}
      >
        Continue to Checkr
      </button>
      {!valid && <p className="survey-hint">Fill in your name, email, and state to continue.</p>}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Teen setup                                                          */
/* ------------------------------------------------------------------ */

function TeenSetupStep({ onDone }) {
  const app = useApp()
  const [profile, setProfile] = useState(
    app.teenProfile ?? {
      name: '',
      age: '',
      grade: '',
      radius: 3,
      services: [],
      rate: 15,
      days: [],
      bio: '',
      cpr: false,
    },
  )

  const set = (key, value) => setProfile((p) => ({ ...p, [key]: value }))
  const toggleIn = (key, value) =>
    setProfile((p) => ({
      ...p,
      [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value],
    }))

  const ready = profile.name.trim() && profile.services.length > 0

  const submit = (e) => {
    e.preventDefault()
    app.setTeenProfile(profile)
    onDone()
  }

  return (
    <form className="survey-step" onSubmit={submit}>
      <span className="survey-badge">Teen setup</span>
      <h1 className="survey-q">Set up how you work</h1>
      <p className="survey-help">
        This is what parents see. You control how far you&apos;ll travel and what you take on.
      </p>

      <div className="form-grid">
        <label className="field">
          <span className="field-label">First name and last initial</span>
          <input
            className="input"
            value={profile.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Maya R."
          />
        </label>
        <label className="field">
          <span className="field-label">Age</span>
          <input
            className="input"
            type="number"
            min="13"
            max="19"
            value={profile.age}
            onChange={(e) => set('age', e.target.value)}
            placeholder="16"
          />
        </label>
      </div>

      <fieldset className="fieldset">
        <legend className="field-label">
          How far will you travel? <strong className="radius-value">{profile.radius} miles</strong>
        </legend>
        <input
          className="radius-slider"
          type="range"
          min="1"
          max="15"
          value={profile.radius}
          onChange={(e) => set('radius', Number(e.target.value))}
        />
        <div className="radius-scale">
          <span>1 mi — my street</span>
          <span>15 mi — whole town</span>
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="field-label">What jobs will you take?</legend>
        <div className="chip-row">
          {SERVICES.map((s) => {
            const on = profile.services.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                className={`priority-chip${on ? ' is-on' : ''}`}
                onClick={() => toggleIn('services', s.id)}
                aria-pressed={on}
              >
                <span className="priority-box" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                {s.emoji} {s.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="field-label">Which days are you usually free?</legend>
        <div className="day-row">
          {WEEKDAYS.map((d) => {
            const on = profile.days.includes(d)
            return (
              <button
                key={d}
                type="button"
                className={`day-chip${on ? ' is-on' : ''}`}
                onClick={() => toggleIn('days', d)}
                aria-pressed={on}
              >
                {d}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="form-grid">
        <label className="field">
          <span className="field-label">Your hourly rate</span>
          <input
            className="input"
            type="number"
            min="5"
            max="60"
            value={profile.rate}
            onChange={(e) => set('rate', Number(e.target.value))}
          />
        </label>
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={profile.cpr}
            onChange={(e) => set('cpr', e.target.checked)}
          />
          <span>I&apos;m CPR / First Aid certified</span>
        </label>
      </div>

      <label className="field">
        <span className="field-label">Tell parents about yourself</span>
        <textarea
          className="textarea"
          value={profile.bio}
          onChange={(e) => set('bio', e.target.value)}
          placeholder="I've watched my younger cousins for two years and I'm on the JV soccer team…"
        />
      </label>

      <button type="submit" className="btn btn-primary btn-lg survey-next" disabled={!ready}>
        Open my dashboard →
      </button>
      {!ready && <p className="survey-hint">Add your name and pick at least one job type.</p>}
    </form>
  )
}
