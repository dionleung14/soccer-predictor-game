import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

function formatDate(iso) {
  if (!iso) return 'Kickoff TBD'
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function MyPicksPage() {
  const [searchParams] = useSearchParams()
  const leagueId = searchParams.get('leagueId')
  const [league, setLeague] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const query = leagueId
          ? `?leagueId=${encodeURIComponent(leagueId)}`
          : ''
        const res = await fetch(`/api/predictions/mine${query}`, {
          credentials: 'include',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || `Failed to load picks (${res.status})`)
        }
        if (!cancelled) {
          setLeague(data.league)
          setPredictions(data.predictions || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [leagueId])

  return (
    <section className="picks-page">
      <div className="picks-page__intro">
        <h1>My picks</h1>
        {league && (
          <p>
            League:{' '}
            <Link to={`/leagues/${league.slug}`}>
              <strong>{league.name}</strong>
            </Link>
            {league.scoringRules && (
              <>
                {' '}
                · Exact score {league.scoringRules.pointsExactScore} pts · Correct
                outcome {league.scoringRules.pointsCorrectOutcome} pts
              </>
            )}
          </p>
        )}
        <p>
          <Link to="/leagues">All leagues</Link>
          {' · '}
          <Link to="/">Back to matches</Link>
        </p>
      </div>

      {loading && <p>Loading your picks…</p>}
      {error && <p className="health-status health-status--error">{error}</p>}

      {!loading && !error && predictions.length === 0 && (
        <p>
          No picks yet for this league. Open a competition from the{' '}
          <Link to={league ? `/leagues/${league.slug}` : '/'}>league hub</Link> and
          submit scorelines.
        </p>
      )}

      {predictions.length > 0 && (
        <div className="picks-list">
          {predictions.map((pick) => (
            <article key={pick.id} className="pick-row">
              <div>
                <strong>
                  {pick.homeTeamName} vs {pick.awayTeamName}
                </strong>
                <div className="pick-row__meta">{formatDate(pick.matchKickoffAt)}</div>
              </div>
              <div className="pick-row__score">
                {pick.predictedHomeScore} – {pick.predictedAwayScore}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
