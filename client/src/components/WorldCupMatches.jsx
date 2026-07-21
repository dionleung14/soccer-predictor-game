import { useState } from 'react'

const WC_MATCHES_URL = '/api/football/v4/competitions/WC/matches'

function formatDate(iso) {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatStage(stage) {
  if (!stage) return ''
  return stage
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function scoreLabel(match) {
  const home = match.score?.fullTime?.home
  const away = match.score?.fullTime?.away
  if (home == null || away == null) return 'vs'
  return `${home} – ${away}`
}

function MatchCard({ match }) {
  return (
    <article className="match-card">
      <header className="match-card__meta">
        <span className="match-card__stage">{formatStage(match.stage)}</span>
        <span className="match-card__status">{match.status}</span>
      </header>
      <div className="match-card__teams">
        <div className="match-card__team">
          {match.homeTeam?.crest && (
            <img src={match.homeTeam.crest} alt="" width={28} height={28} />
          )}
          <span>{match.homeTeam?.name || 'TBD'}</span>
        </div>
        <div className="match-card__score">{scoreLabel(match)}</div>
        <div className="match-card__team match-card__team--away">
          <span>{match.awayTeam?.name || 'TBD'}</span>
          {match.awayTeam?.crest && (
            <img src={match.awayTeam.crest} alt="" width={28} height={28} />
          )}
        </div>
      </div>
      <footer className="match-card__date">{formatDate(match.utcDate)}</footer>
    </article>
  )
}

export default function WorldCupMatches() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const loadMatches = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(WC_MATCHES_URL)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.message || `Request failed (${res.status})`)
      }
      setMatches(Array.isArray(data.matches) ? data.matches : [])
      setLoaded(true)
    } catch (err) {
      setMatches([])
      setLoaded(false)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="wc-matches">
      <div className="wc-matches__intro">
        <h2>World Cup matches</h2>
        <p>Load fixtures and results from the football API via the Express proxy.</p>
        <button
          type="button"
          className="counter"
          onClick={loadMatches}
          disabled={loading}
        >
          {loading ? 'Loading matches…' : 'Load World Cup matches'}
        </button>
        {error && <p className="health-status health-status--error">{error}</p>}
        {loaded && !error && (
          <p className="health-status health-status--ok">
            {matches.length === 0
              ? 'No matches returned for the current World Cup season.'
              : `${matches.length} match${matches.length === 1 ? '' : 'es'} loaded`}
          </p>
        )}
      </div>

      {matches.length > 0 && (
        <div className="match-card-grid">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </section>
  )
}
