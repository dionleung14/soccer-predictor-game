import { Router } from 'express'
import { getPool } from '../db/pool.js'

export const predictionsRouter = Router()

predictionsRouter.get('/', async (_req, res, next) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT id, match_id AS matchId, user_name AS userName,
              home_score AS homeScore, away_score AS awayScore, created_at AS createdAt
       FROM predictions
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    res.json({ predictions: rows })
  } catch (err) {
    next(err)
  }
})

predictionsRouter.post('/', async (req, res, next) => {
  try {
    const { matchId, userName, homeScore, awayScore } = req.body ?? {}

    if (
      matchId == null ||
      !userName ||
      homeScore == null ||
      awayScore == null ||
      Number.isNaN(Number(homeScore)) ||
      Number.isNaN(Number(awayScore))
    ) {
      res.status(400).json({
        error: 'matchId, userName, homeScore, and awayScore are required',
      })
      return
    }

    const pool = getPool()
    const [result] = await pool.query(
      `INSERT INTO predictions (match_id, user_name, home_score, away_score)
       VALUES (:matchId, :userName, :homeScore, :awayScore)`,
      {
        matchId: Number(matchId),
        userName: String(userName).slice(0, 100),
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
      },
    )

    res.status(201).json({
      id: result.insertId,
      matchId: Number(matchId),
      userName: String(userName).slice(0, 100),
      homeScore: Number(homeScore),
      awayScore: Number(awayScore),
    })
  } catch (err) {
    next(err)
  }
})
