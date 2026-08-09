import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Survey from './pages/Survey.jsx'
import SignIn from './pages/SignIn.jsx'
import SetupNeeded from './pages/SetupNeeded.jsx'
import ParentDashboard from './pages/ParentDashboard.jsx'
import TeenDashboard from './pages/TeenDashboard.jsx'
import { isFirebaseConfigured } from './firebase/config.js'
import { useApp } from './state/appContext.js'
import { useAuth } from './state/authContext.js'

/** Router keeps scroll position across routes; every page here wants the top. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

/**
 * Sends anyone who hasn't finished onboarding back to the survey.
 *
 * Waits for Firebase to report auth state and for the profile to load first,
 * otherwise a signed-in user gets bounced on every refresh.
 */
function Guard({ allow, children }) {
  const app = useApp()
  const { loading: authLoading, uid } = useAuth()

  if (!isFirebaseConfigured) return <SetupNeeded />
  if (authLoading || (uid && app.loading)) return <FullPageSpinner />
  if (!uid) return <Navigate to="/signin" replace />
  return allow(app) ? children : <Navigate to="/start" replace />
}

function FullPageSpinner() {
  return (
    <div className="page-spinner">
      <span className="verify-spinner" aria-label="Loading" />
    </div>
  )
}

/** The landing page needs no Firebase; everything past it does. */
function NeedsFirebase({ children }) {
  return isFirebaseConfigured ? children : <SetupNeeded />
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/signin"
          element={
            <NeedsFirebase>
              <SignIn />
            </NeedsFirebase>
          }
        />
        <Route
          path="/start"
          element={
            <NeedsFirebase>
              <Survey />
            </NeedsFirebase>
          }
        />
        {/* Only a completed Checkr report with a clear result unlocks the
            dashboard — "consider" means a human still has to review it. */}
        <Route
          path="/parent"
          element={
            <Guard
              allow={(a) =>
                a.role === 'parent' &&
                a.verification?.status === 'complete' &&
                a.verification?.result === 'clear'
              }
            >
              <ParentDashboard />
            </Guard>
          }
        />
        <Route
          path="/teen"
          element={
            <Guard allow={(a) => a.role === 'teen' && Boolean(a.teenProfile)}>
              <TeenDashboard />
            </Guard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
