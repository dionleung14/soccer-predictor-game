import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getCompetitionByCode } from '../competitions'
import { useAuth } from '../auth/AuthContext'

function isCommissioner(league, userId) {
  if (!league || !userId) return false
  return (
    league.commissionerUserId === userId || league.memberRole === 'commissioner'
  )
}

export default function LeagueDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [league, setLeague] = useState(null)
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState(null)
  const [inviteError, setInviteError] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [copyMessage, setCopyMessage] = useState(null)
  const [regenerating, setRegenerating] = useState(false)
  const [scoringDraft, setScoringDraft] = useState(null)
  const [scoringMessage, setScoringMessage] = useState(null)
  const [scoringError, setScoringError] = useState(null)
  const [savingScoring, setSavingScoring] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const commissioner = isCommissioner(league, user?.id)
  const tournament = league
    ? getCompetitionByCode(league.competitionCode)
    : null

  const joinUrl = useMemo(() => {
    if (!league?.inviteCode || typeof window === 'undefined') return ''
    return `${window.location.origin}/leagues/join/${league.inviteCode}`
  }, [league?.inviteCode])

  const loadLeague = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leagues/${encodeURIComponent(slug)}`, {
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Failed to load league (${res.status})`)
      }
      setLeague(data.league)
      setScoringDraft(data.league.scoringRules || null)

      const standingsRes = await fetch(
        `/api/leagues/${data.league.id}/standings`,
        { credentials: 'include' },
      )
      const standingsData = await standingsRes.json().catch(() => ({}))
      if (standingsRes.ok) {
        setStandings(standingsData.standings || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLeague(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeague()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const copyInviteLink = async () => {
    setCopyMessage(null)
    if (!joinUrl) return
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopyMessage('Invite link copied')
    } catch {
      setCopyMessage('Could not copy — select and copy the link manually')
    }
  }

  const sendInvite = async (event) => {
    event.preventDefault()
    if (!league) return
    setInviteError(null)
    setInviteMessage(null)
    setInviting(true)
    try {
      const res = await fetch(`/api/leagues/${league.id}/invites`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Invite failed (${res.status})`)
      }
      setInviteEmail('')
      setInviteMessage(`Invite sent to ${data.invite.email}`)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err))
    } finally {
      setInviting(false)
    }
  }

  const regenerateInvite = async () => {
    if (!league) return
    setRegenerating(true)
    setCopyMessage(null)
    try {
      const res = await fetch(`/api/leagues/${league.id}/regenerate-invite`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Could not regenerate code (${res.status})`)
      }
      setLeague((prev) =>
        prev ? { ...prev, inviteCode: data.inviteCode } : prev,
      )
      setCopyMessage('Invite code regenerated')
    } catch (err) {
      setCopyMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setRegenerating(false)
    }
  }

  const saveScoringRules = async (event) => {
    event.preventDefault()
    if (!league || !scoringDraft) return
    setScoringError(null)
    setScoringMessage(null)
    setSavingScoring(true)
    try {
      const res = await fetch(`/api/leagues/${league.id}/scoring-rules`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointsExactScore: Number(scoringDraft.pointsExactScore),
          pointsCorrectOutcome: Number(scoringDraft.pointsCorrectOutcome),
          pointsCorrectHomeGoals: Number(scoringDraft.pointsCorrectHomeGoals),
          pointsCorrectAwayGoals: Number(scoringDraft.pointsCorrectAwayGoals),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Could not update scoring (${res.status})`)
      }
      setLeague((prev) =>
        prev ? { ...prev, scoringRules: data.scoringRules } : prev,
      )
      setScoringDraft(data.scoringRules)
      setScoringMessage('Scoring rules updated')
    } catch (err) {
      setScoringError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingScoring(false)
    }
  }

  const deleteLeaguePermanently = async () => {
    if (!league || league.isDefault) return
    const confirmed = window.confirm(
      `Permanently delete "${league.name}"?\n\nThis removes all members, invites, and picks for this league. This cannot be undone.`,
    )
    if (!confirmed) return

    setDeleteError(null)
    setDeleting(true)
    try {
      const res = await fetch(`/api/leagues/${league.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Could not delete league (${res.status})`)
      }
      navigate('/leagues', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <section className="leagues-page">
        <p>Loading league…</p>
      </section>
    )
  }

  if (error || !league) {
    return (
      <section className="leagues-page">
        <p className="health-status health-status--error">
          {error || 'League not found'}
        </p>
        <p>
          <Link to="/leagues">Back to leagues</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="leagues-page">
      <div className="leagues-page__intro">
        <p className="leagues-page__crumb">
          <Link to="/leagues">Leagues</Link>
        </p>
        <h1>{league.name}</h1>
        {league.description && <p>{league.description}</p>}
        <p>
          Tournament:{' '}
          <strong>{tournament?.name || league.competitionCode}</strong>
          {' · '}
          You are {league.memberRole === 'commissioner' ? 'the commissioner' : 'a member'}
          {league.scoringRules && (
            <>
              {' '}
              · Exact {league.scoringRules.pointsExactScore} pts · Outcome{' '}
              {league.scoringRules.pointsCorrectOutcome} pts
            </>
          )}
        </p>
      </div>

      <div className="league-hub">
        <section className="league-panel">
          <h2>Make picks</h2>
          <p>
            This league only scores picks for{' '}
            <strong>{tournament?.name || league.competitionCode}</strong>.
          </p>
          {tournament ? (
            <p>
              <Link
                className="league-pick-cta"
                to={`${tournament.path}?leagueId=${league.id}`}
              >
                Open {tournament.name} fixtures
              </Link>
            </p>
          ) : (
            <p className="health-status health-status--error">
              Unknown tournament code: {league.competitionCode}
            </p>
          )}
          <p>
            <Link to={`/picks?leagueId=${league.id}`}>View my picks for this league</Link>
          </p>
        </section>

        <section className="league-panel">
          <h2>Standings</h2>
          {standings.length === 0 ? (
            <p>No members yet.</p>
          ) : (
            <table className="league-standings">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Points</th>
                  <th>Scored</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, index) => (
                  <tr key={row.userId}>
                    <td>{index + 1}</td>
                    <td>
                      {row.displayName}
                      {row.memberRole === 'commissioner' ? ' ★' : ''}
                    </td>
                    <td>{row.points}</td>
                    <td>
                      {row.scoredPicks}/{row.totalPicks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="league-panel">
          <h2>Members</h2>
          <ul className="league-members">
            {(league.members || []).map((member) => (
              <li key={member.userId}>
                <strong>{member.displayName}</strong>
                <span>
                  {member.memberRole === 'commissioner' ? 'Commissioner' : 'Member'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {commissioner && (
          <section className="league-panel league-panel--commissioner">
            <h2>Commissioner tools</h2>

            <div className="commissioner-block">
              <h3>Invite link</h3>
              <p className="commissioner-link">{joinUrl}</p>
              <div className="commissioner-actions">
                <button type="button" className="counter" onClick={copyInviteLink}>
                  Copy invite link
                </button>
                <button
                  type="button"
                  className="counter"
                  onClick={regenerateInvite}
                  disabled={regenerating}
                >
                  {regenerating ? 'Regenerating…' : 'Regenerate code'}
                </button>
              </div>
              {copyMessage && (
                <p className="health-status health-status--ok">{copyMessage}</p>
              )}
            </div>

            <form className="commissioner-block" onSubmit={sendInvite}>
              <h3>Email invite</h3>
              <label>
                Email
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="friend@example.com"
                />
              </label>
              <button type="submit" className="counter" disabled={inviting}>
                {inviting ? 'Sending…' : 'Send invite'}
              </button>
              {inviteMessage && (
                <p className="health-status health-status--ok">{inviteMessage}</p>
              )}
              {inviteError && (
                <p className="health-status health-status--error">{inviteError}</p>
              )}
            </form>

            <form className="commissioner-block" onSubmit={saveScoringRules}>
              <h3>Scoring rules</h3>
              {scoringDraft && (
                <div className="scoring-grid">
                  <label>
                    Exact score
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoringDraft.pointsExactScore}
                      onChange={(e) =>
                        setScoringDraft((prev) => ({
                          ...prev,
                          pointsExactScore: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Correct outcome
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoringDraft.pointsCorrectOutcome}
                      onChange={(e) =>
                        setScoringDraft((prev) => ({
                          ...prev,
                          pointsCorrectOutcome: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Correct home goals
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoringDraft.pointsCorrectHomeGoals}
                      onChange={(e) =>
                        setScoringDraft((prev) => ({
                          ...prev,
                          pointsCorrectHomeGoals: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Correct away goals
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoringDraft.pointsCorrectAwayGoals}
                      onChange={(e) =>
                        setScoringDraft((prev) => ({
                          ...prev,
                          pointsCorrectAwayGoals: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              )}
              <button type="submit" className="counter" disabled={savingScoring}>
                {savingScoring ? 'Saving…' : 'Save scoring rules'}
              </button>
              {scoringMessage && (
                <p className="health-status health-status--ok">{scoringMessage}</p>
              )}
              {scoringError && (
                <p className="health-status health-status--error">{scoringError}</p>
              )}
            </form>

            {!league.isDefault && (
              <div className="commissioner-block commissioner-block--danger">
                <h3>Delete league</h3>
                <p>
                  Permanently remove this league, its members, invites, and all
                  score picks. This cannot be undone.
                </p>
                <button
                  type="button"
                  className="counter counter--danger"
                  onClick={deleteLeaguePermanently}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete league permanently'}
                </button>
                {deleteError && (
                  <p className="health-status health-status--error">{deleteError}</p>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  )
}
