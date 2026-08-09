import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import Avatar from '../components/Avatar.jsx'
import { useApp } from '../state/appContext.js'
import './DashboardShell.css'

/** Top bar shared by both dashboards. `action` is the page's small primary button. */
export default function DashboardShell({ name, subtitle, verified, action, sidebar, children }) {
  const app = useApp()
  const navigate = useNavigate()

  const signOut = () => {
    app.reset()
    navigate('/')
  }

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-top-inner">
          <Logo to="/" size="sm" />
          <div className="dash-top-right">
            <div className="dash-who">
              <p className="dash-who-name">
                {name}
                {verified && (
                  <span className="dash-verified" title="Background check cleared">
                    ✓
                  </span>
                )}
              </p>
              <p className="dash-who-sub">{subtitle}</p>
            </div>
            <Avatar name={name} size={38} />
            <button type="button" className="btn btn-quiet btn-sm" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="dash-body">
        <aside className="dash-sidebar">{sidebar}</aside>
        <main className="dash-main">
          {action}
          {children}
        </main>
      </div>
    </div>
  )
}
