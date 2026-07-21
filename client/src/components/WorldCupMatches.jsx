import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const WC_MATCHES_URL = '/api/football/v4/competitions/WC/matches'

const LOCKED_STATUSES = new Set([
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'SUSPENDED',
  'AWARDED',
])

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

function isMatchLocked(match) {
  if (match.status && LOCKED_STATUSES.has(String(match.status).toUpperCase())) {
    return true
  }
  if (!match.utcDate) return false
  return new Date(match.utcDate).getTime() <= Date.now()
}

function MatchCard({ match, existingPick, scoringRules, onSavePick, isAuthenticated }) {
  const locked = isMatchLocked(match)
  const [homeScore, setHomeScore] = useState(
    existingPick?.predictedHomeScore ?? '',
  )
  const [awayScore, setAwayScore] = useState(
    existingPick?.predictedAwayScore ?? '',
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setHomeScore(existingPick?.predictedHomeScore ?? '')
    setAwayScore(existingPick?.predictedAwayScore ?? '')
  }, [existingPick])

  const handleSave = async (event) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!isAuthenticated) {
      setError('Sign in to submit a pick')
      return
    }

    if (homeScore === '' || awayScore === '') {
      setError('Enter both scores')
      return
    }

    setSaving(true)
    try {
      await onSavePick({
        externalMatchId: match.id,
        predictedHomeScore: Number(homeScore),
        predictedAwayScore: Number(awayScore),
        homeTeamName: match.homeTeam?.name || 'Home',
        awayTeamName: match.awayTeam?.name || 'Away',
        matchKickoffAt: match.utcDate,
        competitionCode: match.competition?.code || 'WC',
        matchStatus: match.status,
      })
      setMessage('Pick saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

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

      <div className="match-card__pick">
        {locked ? (
          <p className="match-card__pick-note">
            {existingPick
              ? `Your pick: ${existingPick.predictedHomeScore}–${existingPick.predictedAwayScore} (locked)`
              : 'Picks are locked for this match'}
          </p>
        ) : (
          <form className="match-card__pick-form" onSubmit={handleSave}>
            <label>
              Home
              <input
                type="number"
                min="0"
                max="99"
                inputMode="numeric"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                disabled={!isAuthenticated || saving}
              />
            </label>
            <span className="match-card__pick-sep">–</span>
            <label>
              Away
              <input
                type="number"
                min="0"
                max="99"
                inputMode="numeric"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                disabled={!isAuthenticated || saving}
              />
            </label>
            <button type="submit" className="counter" disabled={!isAuthenticated || saving}>
              {saving ? 'Saving…' : existingPick ? 'Update pick' : 'Save pick'}
            </button>
          </form>
        )}

        {!isAuthenticated && !locked && (
          <p className="match-card__pick-note">
            <Link to="/login">Sign in</Link> to make fantasy score picks.
          </p>
        )}
        {scoringRules && (
          <p className="match-card__pick-hint">
            Exact {scoringRules.pointsExactScore} pts · Outcome{' '}
            {scoringRules.pointsCorrectOutcome} pts
          </p>
        )}
        {message && <p className="health-status health-status--ok">{message}</p>}
        {error && <p className="health-status health-status--error">{error}</p>}
      </div>
    </article>
  )
}

export default function WorldCupMatches() {
  const { isAuthenticated } = useAuth()
  const [matches, setMatches] = useState([])
  const [picksByMatchId, setPicksByMatchId] = useState({})
  const [scoringRules, setScoringRules] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const loadPicks = async () => {
    if (!isAuthenticated) {
      setPicksByMatchId({})
      return
    }
    const res = await fetch('/api/predictions/mine/by-match', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || `Failed to load picks (${res.status})`)
    }
    setPicksByMatchId(data.byMatchId || {})
    setScoringRules(data.scoringRules || null)
  }

  const loadMatches = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(WC_MATCHES_URL, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.message || `Request failed (${res.status})`)
      }
      setMatches(Array.isArray(data.matches) ? data.matches : [])
      setLoaded(true)
      if (isAuthenticated) {
        await loadPicks()
      }
    } catch (err) {
      setMatches([])
      setLoaded(false)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && loaded) {
      loadPicks().catch((err) => setError(err.message))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loaded])

  const savePick = async (payload) => {
    const res = await fetch('/api/predictions', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || `Could not save pick (${res.status})`)
    }
    setPicksByMatchId((prev) => ({
      ...prev,
      [data.prediction.externalMatchId]: data.prediction,
    }))
    return data.prediction
  }

  return (
    <section className="wc-matches">
      <div className="wc-matches__intro">
        <h2>Fantasy score picks</h2>
        <p>
          Guess final scores like a fantasy pick game. Exact score and correct
          outcome points are set by the league — commissioners will be able to
          tune these later.
        </p>
        <button
          type="button"
          className="counter"
          onClick={loadMatches}
          disabled={loading}
        >
          {loading ? 'Loading matches…' : 'Load World Cup matches'}
        </button>
        {isAuthenticated && (
          <p>
            <Link to="/picks">View my picks</Link>
          </p>
        )}
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
            <MatchCard
              key={match.id}
              match={match}
              existingPick={picksByMatchId[match.id]}
              scoringRules={scoringRules}
              onSavePick={savePick}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </section>
  )
}
