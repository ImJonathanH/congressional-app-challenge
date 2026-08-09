import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { useAuth } from '../state/authContext.js'
import { friendlyAuthError } from '../state/authErrors.js'
import './Survey.css'

/** Sign-in for people who already have an account. New users go through /start. */
export default function SignIn() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const ready = form.email.trim() && form.password

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(form)
      // App.jsx routes on from here based on the profile Firestore returns.
      navigate('/start', { replace: true })
    } catch (err) {
      setError(friendlyAuthError(err))
      setBusy(false)
    }
  }

  return (
    <div className="survey">
      <header className="survey-top">
        <div className="shell survey-top-inner">
          <Logo to="/" size="sm" />
        </div>
      </header>

      <main className="survey-main">
        <div className="survey-panel">
          <form className="survey-step" onSubmit={submit}>
            <h1 className="survey-q">Welcome back</h1>
            <p className="survey-help">Sign in to get to your dashboard.</p>

            <label className="field auth-field">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                autoFocus
              />
            </label>
            <label className="field auth-field">
              <span className="field-label">Password</span>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete="current-password"
              />
            </label>

            {error && <p className="survey-error">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary btn-lg survey-next"
              disabled={!ready || busy}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="survey-hint">
              New here? <Link to="/start">Create an account</Link>.
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
