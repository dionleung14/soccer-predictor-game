import { getPool } from '../db/pool.js'

export const DEFAULT_LEAGUE_SLUG = 'open-world-cup'

export const DEFAULT_SCORING_RULES = {
  pointsExactScore: 5,
  pointsCorrectOutcome: 2,
  pointsCorrectHomeGoals: 0,
  pointsCorrectAwayGoals: 0,
}

function mapScoringRules(row) {
  return {
    pointsExactScore: row.points_exact_score,
    pointsCorrectOutcome: row.points_correct_outcome,
    pointsCorrectHomeGoals: row.points_correct_home_goals,
    pointsCorrectAwayGoals: row.points_correct_away_goals,
    updatedAt: row.updated_at,
  }
}

function mapLeague(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    commissionerUserId: row.commissioner_user_id,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function ensureDefaultLeague(connection = null) {
  const db = connection || getPool()

  const [existing] = await db.query(
    `SELECT id FROM leagues WHERE slug = :slug LIMIT 1`,
    { slug: DEFAULT_LEAGUE_SLUG },
  )

  if (existing[0]) {
    return existing[0].id
  }

  const [result] = await db.query(
    `INSERT INTO leagues (name, slug, description, is_default)
     VALUES (
       'Open World Cup',
       :slug,
       'Default fantasy pick league. Future private leagues can copy these scoring knobs.',
       1
     )`,
    { slug: DEFAULT_LEAGUE_SLUG },
  )

  const leagueId = result.insertId
  await db.query(
    `INSERT INTO league_scoring_rules (
       league_id,
       points_exact_score,
       points_correct_outcome,
       points_correct_home_goals,
       points_correct_away_goals
     ) VALUES (
       :leagueId,
       :pointsExactScore,
       :pointsCorrectOutcome,
       :pointsCorrectHomeGoals,
       :pointsCorrectAwayGoals
     )`,
    {
      leagueId,
      pointsExactScore: DEFAULT_SCORING_RULES.pointsExactScore,
      pointsCorrectOutcome: DEFAULT_SCORING_RULES.pointsCorrectOutcome,
      pointsCorrectHomeGoals: DEFAULT_SCORING_RULES.pointsCorrectHomeGoals,
      pointsCorrectAwayGoals: DEFAULT_SCORING_RULES.pointsCorrectAwayGoals,
    },
  )

  return leagueId
}

export async function getDefaultLeague() {
  await ensureDefaultLeague()
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT l.*,
            r.points_exact_score,
            r.points_correct_outcome,
            r.points_correct_home_goals,
            r.points_correct_away_goals,
            r.updated_at AS rules_updated_at
     FROM leagues l
     INNER JOIN league_scoring_rules r ON r.league_id = l.id
     WHERE l.slug = :slug
     LIMIT 1`,
    { slug: DEFAULT_LEAGUE_SLUG },
  )

  if (!rows[0]) {
    throw new Error('Default league is not configured')
  }

  const row = rows[0]
  return {
    ...mapLeague(row),
    scoringRules: {
      pointsExactScore: row.points_exact_score,
      pointsCorrectOutcome: row.points_correct_outcome,
      pointsCorrectHomeGoals: row.points_correct_home_goals,
      pointsCorrectAwayGoals: row.points_correct_away_goals,
      updatedAt: row.rules_updated_at,
    },
  }
}

export async function getLeagueScoringRules(leagueId) {
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT * FROM league_scoring_rules WHERE league_id = :leagueId LIMIT 1`,
    { leagueId },
  )
  if (!rows[0]) {
    return { ...DEFAULT_SCORING_RULES }
  }
  return mapScoringRules(rows[0])
}

export async function ensureLeagueMembership(leagueId, userId, memberRole = 'member') {
  const pool = getPool()
  await pool.query(
    `INSERT INTO league_members (league_id, user_id, member_role)
     VALUES (:leagueId, :userId, :memberRole)
     ON DUPLICATE KEY UPDATE member_role = IF(member_role = 'commissioner', 'commissioner', VALUES(member_role))`,
    { leagueId, userId, memberRole },
  )
}

/**
 * Score a pick against a final result using league rules.
 * Exact score awards exact points only (not stacked with outcome).
 * Outcome awards when winner/draw matches but scoreline does not.
 */
export function scorePrediction(prediction, actual, rules) {
  if (
    actual?.home == null ||
    actual?.away == null ||
    prediction?.home == null ||
    prediction?.away == null
  ) {
    return {
      points: 0,
      breakdown: {
        exactScore: false,
        correctOutcome: false,
        correctHomeGoals: false,
        correctAwayGoals: false,
      },
    }
  }

  const exactScore =
    Number(prediction.home) === Number(actual.home) &&
    Number(prediction.away) === Number(actual.away)

  const predictedOutcome = Math.sign(prediction.home - prediction.away)
  const actualOutcome = Math.sign(actual.home - actual.away)
  const correctOutcome = predictedOutcome === actualOutcome
  const correctHomeGoals = Number(prediction.home) === Number(actual.home)
  const correctAwayGoals = Number(prediction.away) === Number(actual.away)

  let points = 0
  if (exactScore) {
    points += rules.pointsExactScore
  } else if (correctOutcome) {
    points += rules.pointsCorrectOutcome
  }

  if (!exactScore) {
    if (correctHomeGoals) points += rules.pointsCorrectHomeGoals
    if (correctAwayGoals) points += rules.pointsCorrectAwayGoals
  }

  return {
    points,
    breakdown: {
      exactScore,
      correctOutcome,
      correctHomeGoals,
      correctAwayGoals,
    },
  }
}
