import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { COMPETITIONS } from '../competitions'
import SignupForm from './SignupForm'

export default function AppHeader() {
  const { user, isAuthenticated, logout, loading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)
  const menuRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (searchParams.get('signup') === '1') {
      setSignupOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('signup')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!menuOpen) return undefined

    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // Session is cleared client-side regardless; server errors are non-blocking for UX.
    }
  }

  const openSignup = () => {
    setMenuOpen(false)
    setSignupOpen(true)
  }

  return (
    <>
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
              <Link to="/leagues">Leagues</Link>
              <Link to="/picks">My picks</Link>
              <Link to="/profile">Profile</Link>
              <button type="button" className="counter app-header__logout" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            !loading && (
              <div className="app-header__account" ref={menuRef}>
                <button
                  type="button"
                  className="app-header__menu-toggle"
                  aria-expanded={menuOpen}
                  aria-controls={menuId}
                  aria-haspopup="menu"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  Account
                  <span className="app-header__menu-caret" aria-hidden="true">
                    {menuOpen ? '▴' : '▾'}
                  </span>
                </button>
                {menuOpen && (
                  <div className="app-header__menu" id={menuId} role="menu">
                    <Link
                      to="/login"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      Sign in
                    </Link>
                    <button type="button" role="menuitem" onClick={openSignup}>
                      Sign up
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </nav>
      </header>

      <SignupForm open={signupOpen} onClose={() => setSignupOpen(false)} />
    </>
  )
}
