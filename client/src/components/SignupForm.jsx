import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PASSWORD_MIN_LENGTH } from './signupConstants'

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  screenName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export default function SignupForm({ open, onClose }) {
  const titleId = useId()
  const closeRef = useRef(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (form.password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/users/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          screenName: form.screenName.trim() || undefined,
          email: form.email.trim(),
          password: form.password,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Signup failed (${res.status})`)
      }

      setSuccess(
        <>
          Account created for {data.email}.{' '}
          <Link to="/login" onClick={onClose}>
            Sign in
          </Link>{' '}
          to continue.
        </>,
      )
      setForm(INITIAL_FORM)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose?.()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal__header">
          <h2 id={titleId}>Create an account</h2>
          <button
            ref={closeRef}
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close sign up"
          >
            ×
          </button>
        </div>

        <div className="signup__panel modal__body">
          <p>
            Sign up to track World Cup predictions. Passwords are hashed with Argon2id and
            never stored in plain text.
          </p>

          <form className="signup__form" onSubmit={handleSubmit} noValidate>
            <div className="signup__row">
              <label>
                First name
                <input
                  name="firstName"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={updateField('firstName')}
                  required
                />
              </label>
              <label>
                Last name
                <input
                  name="lastName"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={updateField('lastName')}
                  required
                />
              </label>
            </div>

            <label>
              Screen name <span className="signup__optional">(optional)</span>
              <input
                name="screenName"
                autoComplete="nickname"
                value={form.screenName}
                onChange={updateField('screenName')}
              />
            </label>

            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={updateField('email')}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                value={form.password}
                onChange={updateField('password')}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={128}
                required
              />
              <span className="signup__hint">
                At least {PASSWORD_MIN_LENGTH} characters, no spaces.
              </span>
            </label>

            <label>
              Confirm password
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={updateField('confirmPassword')}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={128}
                required
              />
            </label>

            <button type="submit" className="counter" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Sign up'}
            </button>
          </form>

          {error && <p className="health-status health-status--error">{error}</p>}
          {success && <p className="health-status health-status--ok">{success}</p>}
        </div>
      </div>
    </div>
  )
}
