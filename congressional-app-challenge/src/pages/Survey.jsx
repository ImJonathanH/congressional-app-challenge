import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { useApp } from '../state/appContext.js'
import { PARENT_PRIORITIES, SERVICES, WEEKDAYS } from '../data/services.js'
import {
  VERIFICATION_STAGES,
  submitBackgroundCheck,
  validateApplicant,
} from '../services/raptorVerification.js'
import './Survey.css'

const ZIP_RE = /^\d{5}$/

/** Ordered step ids per role, used for the progress bar. */
const FLOW = {
  none: ['zip', 'role'],
  parent: ['zip', 'role', 'priorities', 'verify'],
  teen: ['zip', 'role', 'teen-setup'],
}

export default function Survey() {
  const navigate = useNavigate()
  const app = useApp()

  const [step, setStep] = useState('zip')
  const [zip, setZipLocal] = useState(app.zip)
  const [zipError, setZipError] = useState('')
  const [role, setRoleLocal] = useState(app.role)
  const [priorities, setPrioritiesLocal] = useState(app.priorities)
  // Set once the background check starts — you can't back out mid-screening.
  const [locked, setLocked] = useState(false)

  const flow = FLOW[role ?? 'none']
  const stepIndex = Math.max(flow.indexOf(step), 0)
  const progress = ((stepIndex + 1) / flow.length) * 100

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
    app.setZip(zip.trim())
    setStep('role')
  }

  const chooseRole = (nextRole) => {
    setRoleLocal(nextRole)
    app.setRole(nextRole)
    setStep(nextRole === 'parent' ? 'priorities' : 'teen-setup')
  }

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
/* Parent verification                                                 */
/* ------------------------------------------------------------------ */

function VerifyStep({ onStart, onDone }) {
  const app = useApp()
  const [applicant, setApplicant] = useState({
    fullName: '',
    dateOfBirth: '',
    address: '',
    consent: false,
  })
  const [phase, setPhase] = useState('form') // form | running | done
  const [stageIndex, setStageIndex] = useState(-1)
  const [result, setResult] = useState(app.verification)

  const { valid } = validateApplicant(applicant)
  const set = (key) => (e) =>
    setApplicant((a) => ({
      ...a,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

  const run = async (e) => {
    e.preventDefault()
    setPhase('running')
    onStart?.()
    const checked = await submitBackgroundCheck(applicant, (_stage, i) => setStageIndex(i))
    // Keep the name alongside the result so the dashboard can greet them.
    const res = { ...checked, applicantName: applicant.fullName }
    setResult(res)
    app.setVerification(res)
    setPhase('done')
  }

  if (phase === 'done' && result) {
    return (
      <div className="survey-step verify-done">
        <span className="verify-check" aria-hidden="true">
          ✓
        </span>
        <h1 className="survey-q">You&apos;re verified</h1>
        <p className="survey-help">
          Raptor found no criminal records or watchlist matches. Teens will see a verified badge on
          your family profile.
        </p>
        <dl className="verify-receipt card">
          <div>
            <dt>Status</dt>
            <dd className="verify-clear">Clear</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{result.referenceId}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{result.provider}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn-primary btn-lg survey-next" onClick={onDone}>
          Go to my dashboard →
        </button>
      </div>
    )
  }

  if (phase === 'running') {
    return (
      <div className="survey-step">
        <h1 className="survey-q">Running your background check</h1>
        <p className="survey-help">This usually takes under a minute. Don&apos;t close the tab.</p>
        <ol className="verify-stages">
          {VERIFICATION_STAGES.map((stage, i) => (
            <li
              key={stage.id}
              className={`verify-stage${i < stageIndex ? ' is-done' : ''}${
                i === stageIndex ? ' is-active' : ''
              }`}
            >
              <span className="verify-dot" aria-hidden="true">
                {i < stageIndex ? '✓' : ''}
              </span>
              <span>
                <span className="verify-stage-label">{stage.label}</span>
                <span className="verify-stage-detail">{stage.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <form className="survey-step" onSubmit={run}>
      <span className="survey-badge">Required for parents</span>
      <h1 className="survey-q">Verify your identity</h1>
      <p className="survey-help">
        Every parent is screened through Raptor before they can message a teen. Teens are trusting
        you with their time and safety — this is the part that earns it.
      </p>

      <div className="form-grid">
        <label className="field">
          <span className="field-label">Full legal name</span>
          <input
            className="input"
            value={applicant.fullName}
            onChange={set('fullName')}
            placeholder="Jordan Alvarez"
            autoComplete="name"
          />
        </label>
        <label className="field">
          <span className="field-label">Date of birth</span>
          <input
            className="input"
            type="date"
            value={applicant.dateOfBirth}
            onChange={set('dateOfBirth')}
          />
        </label>
        <label className="field form-full">
          <span className="field-label">Home address</span>
          <input
            className="input"
            value={applicant.address}
            onChange={set('address')}
            placeholder="482 Sylvan Ave, Mountain View, CA"
            autoComplete="street-address"
          />
        </label>
      </div>

      <label className="consent">
        <input type="checkbox" checked={applicant.consent} onChange={set('consent')} />
        <span>
          I authorize TeenHands and Raptor Technologies to run a background check, including
          criminal-record and watchlist screening, and I confirm the information above is mine.
        </span>
      </label>

      <p className="survey-disclaimer">
        Demo note: this prototype simulates the Raptor screening. No data leaves your browser and no
        real check is performed.
      </p>

      <button type="submit" className="btn btn-primary btn-lg survey-next" disabled={!valid}>
        Run background check
      </button>
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
