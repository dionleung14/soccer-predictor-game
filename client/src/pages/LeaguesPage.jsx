import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function LeaguesPage() {
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  const loadLeagues = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leagues/mine', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Failed to load leagues (${res.status})`)
      }
      setLeagues(data.leagues || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeagues()
  }, [])

  const handleCreate = async (event) => {
    event.preventDefault()
    setCreateError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Could not create league (${res.status})`)
      }
      setName('')
      setDescription('')
      navigate(`/leagues/${data.league.slug}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="leagues-page">
      <div className="leagues-page__intro">
        <h1>Leagues</h1>
        <p>
          Create a private league, invite friends, and compete on score picks. You
          become commissioner of any league you create.
        </p>
      </div>

      <form className="leagues-create" onSubmit={handleCreate}>
        <h2>Create a league</h2>
        <label>
          Name
          <input
            type="text"
            name="name"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Office World Cup pool"
          />
        </label>
        <label>
          Description <span className="leagues-optional">(optional)</span>
          <textarea
            name="description"
            maxLength={500}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Friendly score predictions among friends"
          />
        </label>
        <button type="submit" className="counter" disabled={creating || !name.trim()}>
          {creating ? 'Creating…' : 'Create league'}
        </button>
        {createError && (
          <p className="health-status health-status--error">{createError}</p>
        )}
      </form>

      <div className="leagues-list">
        <h2>Your leagues</h2>
        {loading && <p>Loading leagues…</p>}
        {error && <p className="health-status health-status--error">{error}</p>}
        {!loading && !error && leagues.length === 0 && (
          <p>You are not in any leagues yet. Create one above to get started.</p>
        )}
        {leagues.length > 0 && (
          <ul className="leagues-list__items">
            {leagues.map((league) => (
              <li key={league.id}>
                <Link to={`/leagues/${league.slug}`} className="leagues-list__card">
                  <strong>{league.name}</strong>
                  <span>
                    {league.memberRole === 'commissioner' ? 'Commissioner' : 'Member'}
                    {league.isDefault ? ' · Open league' : ''}
                  </span>
                  {league.description && <span>{league.description}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
