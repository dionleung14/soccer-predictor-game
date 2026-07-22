import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { COMPETITIONS } from '../competitions'

export default function AppHeader() {
  const { user, isAuthenticated, logout, loading } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // Session is cleared client-side regardless; server errors are non-blocking for UX.
    }
  }

  return (
    <header className="app-header">
      <div className="app-header__left">
        <Link to="/" className="app-header__brand">
          Soccer Predictor
        </Link>
        <nav className="app-header__competitions" aria-label="Competitions">
          {COMPETITIONS.map((competition) => (
            <NavLink
              key={competition.code}
              to={competition.path}
              className={({ isActive }) =>
                isActive ? 'app-header__comp-link is-active' : 'app-header__comp-link'
              }
            >
              {competition.shortName}
            </NavLink>
          ))}
        </nav>
      </div>
      <nav className="app-header__nav">
        {!loading && isAuthenticated ? (
          <>
            <span className="app-header__user">
              {user.screenName || user.firstName || user.email}
            </span>
            <Link to="/picks">My picks</Link>
            <Link to="/welcome">Welcome</Link>
            <button type="button" className="counter app-header__logout" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          !loading && <Link to="/login">Sign in</Link>
        )}
      </nav>
    </header>
  )
}
