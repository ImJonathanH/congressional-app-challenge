import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Survey from './pages/Survey.jsx'
import ParentDashboard from './pages/ParentDashboard.jsx'
import TeenDashboard from './pages/TeenDashboard.jsx'
import { useApp } from './state/appContext.js'

/** Sends anyone who hasn't finished onboarding back to the survey. */
function Guard({ allow, children }) {
  const app = useApp()
  return allow(app) ? children : <Navigate to="/start" replace />
}

/** Router keeps scroll position across routes; every page here wants the top. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/start" element={<Survey />} />
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
