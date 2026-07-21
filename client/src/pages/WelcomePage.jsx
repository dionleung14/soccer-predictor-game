import { useAuth } from '../auth/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function WelcomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/', { replace: true })
    }
  }

  const name = user?.screenName || user?.firstName || user?.email || 'there'

  return (
    <section className="auth-page">
      <div className="auth-page__card">
        <h1>Thank you for signing in</h1>
        <p>
          Welcome back, <strong>{name}</strong>. You are on a protected route that only
          signed-in users can open.
        </p>
        <div className="auth-page__actions">
          <button type="button" className="counter" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </section>
  )
}
