import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { getPool } from '../db/pool.js'
import {
  getLeagueById,
  getLeagueScoringRules,
  resolveLeagueIdForUser,
  scorePrediction,
} from '../leagues/leagueService.js'

export const predictionsRouter = Router()

const LOCKED_STATUSES = new Set([
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'SUSPENDED',
  'AWARDED',
])

function mapPrediction(row) {
  return {
    id: row.id,
    leagueId: row.league_id,
    userId: row.user_id,
    externalMatchId: row.external_match_id,
    competitionCode: row.competition_code,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    matchKickoffAt: row.match_kickoff_at,
    predictedHomeScore: row.predicted_home_score,
    predictedAwayScore: row.predicted_away_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isKickoffPassed(kickoffAt) {
  if (!kickoffAt) return false
  return new Date(kickoffAt).getTime() <= Date.now()
}

function validateScore(value, field) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 99) {
    return `${field} must be an integer from 0 to 99`
  }
  return null
}

predictionsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const leagueId = await resolveLeagueIdForUser(
      req.query.leagueId,
      req.session.userId,
    )
    const league = await getLeagueById(leagueId, {
      viewerUserId: req.session.userId,
    })

    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT *
       FROM match_predictions
       WHERE league_id = :leagueId AND user_id = :userId
       ORDER BY match_kickoff_at IS NULL, match_kickoff_at ASC, updated_at DESC`,
      { leagueId, userId: req.session.userId },
    )

    res.json({
      league,
      predictions: rows.map(mapPrediction),
    })
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

predictionsRouter.get('/mine/by-match', requireAuth, async (req, res, next) => {
  try {
    const leagueId = await resolveLeagueIdForUser(
      req.query.leagueId,
      req.session.userId,
    )
    const league = await getLeagueById(leagueId, {
      viewerUserId: req.session.userId,
    })

    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT *
       FROM match_predictions
       WHERE league_id = :leagueId AND user_id = :userId`,
      { leagueId, userId: req.session.userId },
    )

    const byMatchId = {}
    for (const row of rows) {
      byMatchId[row.external_match_id] = mapPrediction(row)
    }

    res.json({
      leagueId,
      league,
      scoringRules: league?.scoringRules || null,
      byMatchId,
    })
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

predictionsRouter.put('/', requireAuth, async (req, res, next) => {
  try {
    const {
      externalMatchId,
      predictedHomeScore,
      predictedAwayScore,
      homeTeamName,
      awayTeamName,
      matchKickoffAt,
      competitionCode,
      matchStatus,
      leagueId: bodyLeagueId,
    } = req.body ?? {}

    if (externalMatchId == null || !homeTeamName || !awayTeamName) {
      res.status(400).json({
        error: 'externalMatchId, homeTeamName, and awayTeamName are required',
      })
      return
    }

    const homeError = validateScore(predictedHomeScore, 'predictedHomeScore')
    const awayError = validateScore(predictedAwayScore, 'predictedAwayScore')
    if (homeError || awayError) {
      res.status(400).json({ error: homeError || awayError })
      return
    }

    if (matchStatus && LOCKED_STATUSES.has(String(matchStatus).toUpperCase())) {
      res.status(403).json({ error: 'Predictions are locked for this match' })
      return
    }

    if (isKickoffPassed(matchKickoffAt)) {
      res.status(403).json({ error: 'Predictions lock at kickoff' })
      return
    }

    const leagueId = await resolveLeagueIdForUser(
      bodyLeagueId ?? req.query.leagueId,
      req.session.userId,
    )
    const league = await getLeagueById(leagueId, {
      viewerUserId: req.session.userId,
    })
    if (!league) {
      res.status(404).json({ error: 'League not found' })
      return
    }

    const resolvedCompetition = String(
      competitionCode || league.competitionCode || 'WC',
    )
      .trim()
      .toUpperCase()
      .slice(0, 16)

    if (resolvedCompetition !== league.competitionCode) {
      res.status(400).json({
        error: `This league only accepts picks for ${league.competitionCode}`,
      })
      return
    }

    const pool = getPool()
    await pool.query(
      `INSERT INTO match_predictions (
         league_id, user_id, external_match_id, competition_code,
         home_team_name, away_team_name, match_kickoff_at,
         predicted_home_score, predicted_away_score
       ) VALUES (
         :leagueId, :userId, :externalMatchId, :competitionCode,
         :homeTeamName, :awayTeamName, :matchKickoffAt,
         :predictedHomeScore, :predictedAwayScore
       )
       ON DUPLICATE KEY UPDATE
         home_team_name = VALUES(home_team_name),
         away_team_name = VALUES(away_team_name),
         match_kickoff_at = VALUES(match_kickoff_at),
         competition_code = VALUES(competition_code),
         predicted_home_score = VALUES(predicted_home_score),
         predicted_away_score = VALUES(predicted_away_score)`,
      {
        leagueId,
        userId: req.session.userId,
        externalMatchId: Number(externalMatchId),
        competitionCode: resolvedCompetition,
        homeTeamName: String(homeTeamName).slice(0, 120),
        awayTeamName: String(awayTeamName).slice(0, 120),
        matchKickoffAt: matchKickoffAt ? new Date(matchKickoffAt) : null,
        predictedHomeScore: Number(predictedHomeScore),
        predictedAwayScore: Number(predictedAwayScore),
      },
    )

    const [rows] = await pool.query(
      `SELECT * FROM match_predictions
       WHERE league_id = :leagueId
         AND user_id = :userId
         AND external_match_id = :externalMatchId
       LIMIT 1`,
      {
        leagueId,
        userId: req.session.userId,
        externalMatchId: Number(externalMatchId),
      },
    )

    res.json({ prediction: mapPrediction(rows[0]) })
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

/**
 * Score a stored pick against an actual final score using the league's rules.
 * Useful once results arrive from the football API.
 */
predictionsRouter.post('/score-preview', requireAuth, async (req, res, next) => {
  try {
    const {
      predictedHomeScore,
      predictedAwayScore,
      actualHomeScore,
      actualAwayScore,
      leagueId,
    } = req.body ?? {}

    const resolvedLeagueId = await resolveLeagueIdForUser(
      leagueId,
      req.session.userId,
    )
    const rules = await getLeagueScoringRules(resolvedLeagueId)
    const result = scorePrediction(
      { home: Number(predictedHomeScore), away: Number(predictedAwayScore) },
      { home: Number(actualHomeScore), away: Number(actualAwayScore) },
      rules,
    )

    res.json({
      leagueId: resolvedLeagueId,
      scoringRules: rules,
      ...result,
    })
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})
