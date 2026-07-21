import { useState } from 'react'
import './App.css'
import QueryRunner from './components/QueryRunner'
import WorldCupMatches from './components/WorldCupMatches'

function App() {
  const [healthStatus, setHealthStatus] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)

  const checkServerHealth = async () => {
    setHealthLoading(true)
    setHealthStatus(null)
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      setHealthStatus({
        ok: res.ok && data.ok,
        message: res.ok
          ? `Server OK · ${data.service} · db ${data.database}`
          : `Health check failed (${res.status})${data.detail ? ` · ${data.detail}` : ''}`,
      })
    } catch (err) {
      setHealthStatus({
        ok: false,
        message: `Server unreachable · ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setHealthLoading(false)
    }
  }

  return (
    <>
      <section id="center">
        <button
          type="button"
          className="counter"
          onClick={checkServerHealth}
          disabled={healthLoading}
        >
          {healthLoading ? 'Checking server…' : 'Check API health'}
        </button>
        {healthStatus && (
          <p
            className={
              healthStatus.ok ? 'health-status health-status--ok' : 'health-status health-status--error'
            }
          >
            {healthStatus.message}
          </p>
        )}
      </section>

      <WorldCupMatches />

      <section style={{ padding: 20, background: '#f2f4f7' }}>
        <QueryRunner />
      </section>

      <section id="spacer"></section>
    </>
  )
}

export default App
