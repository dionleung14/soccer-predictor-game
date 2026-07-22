import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function formatJoinedDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/', { replace: true })
    }
  }

  const displayName =
    user?.screenName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email
  const joined = formatJoinedDate(user?.createdAt)

  return (
    <section className="auth-page">
      <div className="auth-page__card">
        <h1>Profile</h1>
        <p>
          Signed in as <strong>{displayName}</strong>.
        </p>

        <dl className="profile-details">
          <div>
            <dt>Name</dt>
            <dd>
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'}
            </dd>
          </div>
          {user?.screenName && (
            <div>
              <dt>Screen name</dt>
              <dd>{user.screenName}</dd>
            </div>
          )}
          <div>
            <dt>Email</dt>
            <dd>{user?.email || '—'}</dd>
          </div>
          {joined && (
            <div>
              <dt>Joined</dt>
              <dd>{joined}</dd>
            </div>
          )}
        </dl>

        <div className="auth-page__actions">
          <Link to="/picks" className="counter">
            My picks
          </Link>
          <button type="button" className="counter" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </section>
  )
}
