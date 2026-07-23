import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function JoinLeaguePage() {
  const { inviteCode } = useParams()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [league, setLeague] = useState(null)

  useEffect(() => {
    if (authLoading || !isAuthenticated || !inviteCode) return undefined

    let cancelled = false
    ;(async () => {
      setStatus('joining')
      setError(null)
      try {
        const res = await fetch(
          `/api/leagues/join/${encodeURIComponent(inviteCode)}`,
          {
            method: 'POST',
            credentials: 'include',
          },
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || `Could not join league (${res.status})`)
        }
        if (!cancelled) {
          setLeague(data.league)
          setStatus('joined')
          navigate(`/leagues/${data.league.slug}`, { replace: true })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setStatus('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, inviteCode, navigate])

  if (authLoading) {
    return (
      <section className="leagues-page">
        <p>Checking your session…</p>
      </section>
    )
  }

  if (!isAuthenticated) {
    const next = `/leagues/join/${encodeURIComponent(inviteCode || '')}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  return (
    <section className="leagues-page">
      <h1>Join league</h1>
      {status === 'joining' && <p>Joining league…</p>}
      {status === 'joined' && league && (
        <p className="health-status health-status--ok">
          Joined {league.name}. Redirecting…
        </p>
      )}
      {status === 'error' && (
        <>
          <p className="health-status health-status--error">{error}</p>
          <p>
            <Link to="/leagues">Back to leagues</Link>
          </p>
        </>
      )}
    </section>
  )
}
