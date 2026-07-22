import { Router } from 'express'
import {
  getCompetitionMatches,
  getSyncStatus,
  isCachedCompetition,
  syncCompetitionFixtures,
  shouldRefreshFromApi,
} from '../fixtures/fixturesService.js'
import { CACHED_COMPETITION_CODES } from '../fixtures/competitionCodes.js'

export const competitionsRouter = Router()

competitionsRouter.get('/', (_req, res) => {
  res.json({
    competitions: CACHED_COMPETITION_CODES.map((code) => ({ code })),
  })
})

competitionsRouter.get('/:code/matches', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').toUpperCase()
    if (!isCachedCompetition(code)) {
      res.status(404).json({
        error: `Unknown or uncached competition code: ${code}`,
        supported: CACHED_COMPETITION_CODES,
      })
      return
    }

    const payload = await getCompetitionMatches(code)
    res.json(payload)
  } catch (err) {
    next(err)
  }
})

competitionsRouter.get('/:code/sync-status', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').toUpperCase()
    if (!isCachedCompetition(code)) {
      res.status(404).json({ error: `Unknown competition code: ${code}` })
      return
    }
    const syncStatus = await getSyncStatus(code)
    const refreshHint = await shouldRefreshFromApi(code)
    res.json({ syncStatus, refreshHint })
  } catch (err) {
    next(err)
  }
})

/**
 * Manual / ops sync endpoint. Future daily job can call the same service method.
 * Protect with FIXTURES_SYNC_TOKEN when set.
 */
competitionsRouter.post('/:code/sync', async (req, res, next) => {
  try {
    const expected = process.env.FIXTURES_SYNC_TOKEN
    if (expected) {
      const provided = req.get('x-fixtures-sync-token') || req.body?.token
      if (provided !== expected) {
        res.status(401).json({ error: 'Invalid fixtures sync token' })
        return
      }
    }

    const code = String(req.params.code || '').toUpperCase()
    if (!isCachedCompetition(code)) {
      res.status(404).json({ error: `Unknown competition code: ${code}` })
      return
    }

    const result = await syncCompetitionFixtures(code)
    res.json(result)
  } catch (err) {
    next(err)
  }
})
