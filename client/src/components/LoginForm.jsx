import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const INITIAL_FORM = {
  email: '',
  password: '',
}

export default function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({
        email: form.email.trim(),
        password: form.password,
      })
      setForm(INITIAL_FORM)
      navigate('/welcome', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="signup">
      <div className="signup__panel">
        <h2>Sign in</h2>
        <p>
          Use the email and password from your account.{' '}
          <Link to="/?signup=1">Need an account?</Link>
        </p>

        <form className="signup__form" onSubmit={handleSubmit} noValidate>
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
              autoComplete="current-password"
              value={form.password}
              onChange={updateField('password')}
              required
            />
          </label>

          <button type="submit" className="counter" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && <p className="health-status health-status--error">{error}</p>}
      </div>
    </section>
  )
}
