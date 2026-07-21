import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

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
      <Link to="/" className="app-header__brand">
        Soccer Predictor
      </Link>
      <nav className="app-header__nav">
        {!loading && isAuthenticated ? (
          <>
            <span className="app-header__user">
              {user.screenName || user.firstName || user.email}
            </span>
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
