import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import collection from '../../sample_payloads/api_req_collection.json'

function buildUrl(raw, baseUrl, competitionId) {
  let url = typeof raw === 'string' ? raw : (raw && raw.raw) || ''
  const base = (baseUrl || '').replace(/\/$/, '')
  url = url.replace(/{{url}}/g, base)
  if (competitionId) {
    url = url.replace(/\/competitions\/[^\/\?&]*/g, `/competitions/${competitionId}`)
  }
  // If developer used the real football-data host as the base, rewrite to the
  // proxied path so Vite dev server proxy handles CORS in development.
  const apiHost = 'https://api.football-data.org'
  if (url.startsWith(apiHost)) {
    url = url.replace(apiHost, '') || '/'
  }
  return url
}

export default function QueryRunner() {
  const qc = useQueryClient()
  const defaultBase = collection.variable?.find((v) => v.key === 'url')?.value || ''
  const [baseUrl, setBaseUrl] = useState(defaultBase)
  const [competitionId, setCompetitionId] = useState('WC')
  const [apiToken, setApiToken] = useState('')
  const [responses, setResponses] = useState([])

  const runRequest = async (item, idx) => {
    const raw = item.request && (typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw) || ''
    const finalUrl = buildUrl(raw, baseUrl, competitionId)
    const headers = {}
    if (apiToken) headers['X-Auth-Token'] = apiToken

    const key = ['api', idx, finalUrl]
    console.log(finalUrl)
    try {
      const data = await qc.fetchQuery({
        queryKey: key,
        queryFn: async () => {
          const res = await fetch(finalUrl, { headers })
          const ct = res.headers.get('content-type') || ''
          const payload = ct.includes('application/json') ? await res.json() : await res.text()
          return { status: res.status, ok: res.ok, payload }
        },
        staleTime: 60_000,
      })

      setResponses((p) => [
        { id: Date.now(), name: item.name, url: finalUrl, status: data.status, ok: data.ok, payload: data.payload },
        ...p,
      ])
    } catch (err) {
      setResponses((p) => [
        { id: Date.now(), name: item.name, url: finalUrl, status: 'error', error: String(err) },
        ...p,
      ])
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>API Query Console</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Base URL
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={{ width: 360 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Competition ID
          <input value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} style={{ width: 120 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          API Token (X-Auth-Token)
          <input value={apiToken} onChange={(e) => setApiToken(e.target.value)} style={{ width: 280 }} placeholder="optional" />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {collection.item.map((it, i) => (
          <button key={it.id} onClick={() => runRequest(it, i)} style={{ padding: '8px 12px' }}>
            {it.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {responses.map((r) => (
          <div key={r.id} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong>{r.name}</strong>
              <span>{r.status}</span>
            </div>
            <div style={{ fontSize: 12, color: '#333', marginBottom: 8 }}>{r.url}</div>
            <div style={{ maxHeight: 300, overflow: 'auto', background: '#f7f7f7', padding: 8 }}>
              {r.error ? (
                <pre style={{ whiteSpace: 'pre-wrap' }}>{r.error}</pre>
              ) : typeof r.payload === 'string' ? (
                <pre style={{ whiteSpace: 'pre-wrap' }}>{r.payload}</pre>
              ) : (
                <pre>{JSON.stringify(r.payload, null, 2)}</pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
