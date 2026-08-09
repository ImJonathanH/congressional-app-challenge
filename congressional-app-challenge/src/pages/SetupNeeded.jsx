import Logo from '../components/Logo.jsx'
import './Survey.css'

/**
 * Shown when .env has no Firebase config. Better than a blank page with a
 * stack trace in the console — the same reasoning as the Checkr 503.
 */
export default function SetupNeeded() {
  return (
    <div className="survey">
      <header className="survey-top">
        <div className="shell survey-top-inner">
          <Logo to={null} size="sm" />
        </div>
      </header>

      <main className="survey-main">
        <div className="survey-panel">
          <div className="survey-step">
            <span className="survey-badge">Setup needed</span>
            <h1 className="survey-q">Firebase isn&apos;t configured yet</h1>
            <p className="survey-help">
              TeenHands stores accounts and listings in Firebase, so it needs a project before it
              can run. This takes about five minutes.
            </p>

            <ol className="setup-steps">
              <li>
                Create a project at <code>console.firebase.google.com</code>, then add a{' '}
                <strong>Web app</strong> to it.
              </li>
              <li>
                Turn on <strong>Authentication → Email/Password</strong> and create a{' '}
                <strong>Cloud Firestore</strong> database.
              </li>
              <li>
                Copy <code>.env.example</code> to <code>.env</code> and paste in the config values
                Firebase showed you.
              </li>
              <li>
                Restart the dev server, then run <code>npm run seed</code> to load the demo teens
                and jobs.
              </li>
            </ol>

            <p className="survey-disclaimer">
              Full instructions, including the security rules and the service-account key the
              server needs, are in the README under “Firebase setup”.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
