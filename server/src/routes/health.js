import { Router } from 'express'
import { checkDatabase, getPool } from '../db/pool.js'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  const payload = {
    ok: true,
    service: 'soccer-predictor-api',
    database: 'disconnected',
  }

  try {
    getPool()
    const reachable = await checkDatabase()
    payload.database = reachable ? 'connected' : 'error'
    payload.ok = reachable
    res.status(reachable ? 200 : 503).json(payload)
  } catch (err) {
    payload.ok = false
    payload.database = 'error'
    payload.detail = err instanceof Error ? err.message : String(err)
    res.status(503).json(payload)
  }
})
