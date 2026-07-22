import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  ensureDefaultLeague,
  ensureLeagueMembership,
  getDefaultLeague,
  getLeagueScoringRules,
} from '../leagues/leagueService.js'
import { getPool } from '../db/pool.js'

export const leaguesRouter = Router()

leaguesRouter.get('/default', async (_req, res, next) => {
  try {
    const league = await getDefaultLeague()
    res.json({ league })
  } catch (err) {
    next(err)
  }
})

/**
 * Future commissioner endpoint: update scoring knobs for a league you own.
 * Wired now so league tooling can land without schema churn.
 */
leaguesRouter.patch('/:leagueId/scoring-rules', requireAuth, async (req, res, next) => {
  try {
    const leagueId = Number(req.params.leagueId)
    const userId = req.session.userId
    const pool = getPool()

    const [leagues] = await pool.query(
      `SELECT id, commissioner_user_id FROM leagues WHERE id = :leagueId LIMIT 1`,
      { leagueId },
    )
    if (!leagues[0]) {
      res.status(404).json({ error: 'League not found' })
      return
    }

    const isCommissioner = leagues[0].commissioner_user_id === userId
    const [membership] = await pool.query(
      `SELECT member_role FROM league_members
       WHERE league_id = :leagueId AND user_id = :userId
       LIMIT 1`,
      { leagueId, userId },
    )
    const memberIsCommissioner = membership[0]?.member_role === 'commissioner'

    if (!isCommissioner && !memberIsCommissioner) {
      res.status(403).json({ error: 'Only the league commissioner can update scoring rules' })
      return
    }

    const {
      pointsExactScore,
      pointsCorrectOutcome,
      pointsCorrectHomeGoals,
      pointsCorrectAwayGoals,
    } = req.body ?? {}

    const current = await getLeagueScoringRules(leagueId)
    const nextRules = {
      pointsExactScore:
        pointsExactScore == null ? current.pointsExactScore : Number(pointsExactScore),
      pointsCorrectOutcome:
        pointsCorrectOutcome == null
          ? current.pointsCorrectOutcome
          : Number(pointsCorrectOutcome),
      pointsCorrectHomeGoals:
        pointsCorrectHomeGoals == null
          ? current.pointsCorrectHomeGoals
          : Number(pointsCorrectHomeGoals),
      pointsCorrectAwayGoals:
        pointsCorrectAwayGoals == null
          ? current.pointsCorrectAwayGoals
          : Number(pointsCorrectAwayGoals),
    }

    for (const [key, value] of Object.entries(nextRules)) {
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        res.status(400).json({ error: `${key} must be an integer from 0 to 100` })
        return
      }
    }

    await pool.query(
      `UPDATE league_scoring_rules
       SET points_exact_score = :pointsExactScore,
           points_correct_outcome = :pointsCorrectOutcome,
           points_correct_home_goals = :pointsCorrectHomeGoals,
           points_correct_away_goals = :pointsCorrectAwayGoals
       WHERE league_id = :leagueId`,
      { leagueId, ...nextRules },
    )

    res.json({
      leagueId,
      scoringRules: nextRules,
    })
  } catch (err) {
    next(err)
  }
})

leaguesRouter.post('/default/join', requireAuth, async (req, res, next) => {
  try {
    const leagueId = await ensureDefaultLeague()
    await ensureLeagueMembership(leagueId, req.session.userId, 'member')
    const league = await getDefaultLeague()
    res.json({ league, joined: true })
  } catch (err) {
    next(err)
  }
})
