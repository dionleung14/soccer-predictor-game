import crypto from 'node:crypto'
import { getPool } from '../db/pool.js'
import { isCachedCompetition } from '../fixtures/competitionCodes.js'

export const DEFAULT_LEAGUE_SLUG = 'open-world-cup'
export const DEFAULT_COMPETITION_CODE = 'WC'

export const DEFAULT_SCORING_RULES = {
  pointsExactScore: 5,
  pointsCorrectOutcome: 2,
  pointsCorrectHomeGoals: 0,
  pointsCorrectAwayGoals: 0,
}

const FINISHED_STATUSES = new Set(['FINISHED', 'AWARDED'])

export function normalizeCompetitionCode(code) {
  const normalized = String(code || '')
    .trim()
    .toUpperCase()
  if (!isCachedCompetition(normalized)) {
    const error = new Error(
      `competitionCode must be one of: WC, PL, EC (got ${code || 'empty'})`,
    )
    error.status = 400
    throw error
  }
  return normalized
}

export function mapScoringRules(row) {
  return {
    pointsExactScore: row.points_exact_score,
    pointsCorrectOutcome: row.points_correct_outcome,
    pointsCorrectHomeGoals: row.points_correct_home_goals,
    pointsCorrectAwayGoals: row.points_correct_away_goals,
    updatedAt: row.updated_at,
  }
}

export function mapLeague(row, { includeInviteCode = false } = {}) {
  const league = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    commissionerUserId: row.commissioner_user_id,
    competitionCode: row.competition_code || DEFAULT_COMPETITION_CODE,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  if (includeInviteCode) {
    league.inviteCode = row.invite_code || null
  }
  return league
}

export function generateInviteCode(length = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length]
  }
  return code
}

export function slugifyName(name) {
  const base = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return base || 'league'
}

async function allocateUniqueSlug(db, name) {
  const base = slugifyName(name)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${generateInviteCode(4).toLowerCase()}`
    const slug = `${base}${suffix}`.slice(0, 120)
    const [existing] = await db.query(
      `SELECT id FROM leagues WHERE slug = :slug LIMIT 1`,
      { slug },
    )
    if (!existing[0]) return slug
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 120)
}

async function allocateUniqueInviteCode(db) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = generateInviteCode()
    const [existing] = await db.query(
      `SELECT id FROM leagues WHERE invite_code = :inviteCode LIMIT 1`,
      { inviteCode },
    )
    if (!existing[0]) return inviteCode
  }
  throw new Error('Could not allocate a unique invite code')
}

async function insertScoringRules(db, leagueId, rules = DEFAULT_SCORING_RULES) {
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
      pointsExactScore: rules.pointsExactScore,
      pointsCorrectOutcome: rules.pointsCorrectOutcome,
      pointsCorrectHomeGoals: rules.pointsCorrectHomeGoals,
      pointsCorrectAwayGoals: rules.pointsCorrectAwayGoals,
    },
  )
}

function normalizeScoringInput(input = {}, fallback = DEFAULT_SCORING_RULES) {
  const next = {
    pointsExactScore:
      input.pointsExactScore == null
        ? fallback.pointsExactScore
        : Number(input.pointsExactScore),
    pointsCorrectOutcome:
      input.pointsCorrectOutcome == null
        ? fallback.pointsCorrectOutcome
        : Number(input.pointsCorrectOutcome),
    pointsCorrectHomeGoals:
      input.pointsCorrectHomeGoals == null
        ? fallback.pointsCorrectHomeGoals
        : Number(input.pointsCorrectHomeGoals),
    pointsCorrectAwayGoals:
      input.pointsCorrectAwayGoals == null
        ? fallback.pointsCorrectAwayGoals
        : Number(input.pointsCorrectAwayGoals),
  }

  for (const [key, value] of Object.entries(next)) {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      const error = new Error(`${key} must be an integer from 0 to 100`)
      error.status = 400
      throw error
    }
  }
  return next
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

  const inviteCode = await allocateUniqueInviteCode(db)
  const [result] = await db.query(
    `INSERT INTO leagues (name, slug, description, invite_code, competition_code, is_default)
     VALUES (
       'Open World Cup',
       :slug,
       'Default fantasy pick league. Future private leagues can copy these scoring knobs.',
       :inviteCode,
       :competitionCode,
       1
     )`,
    {
      slug: DEFAULT_LEAGUE_SLUG,
      inviteCode,
      competitionCode: DEFAULT_COMPETITION_CODE,
    },
  )

  const leagueId = result.insertId
  await insertScoringRules(db, leagueId)
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

export async function getMembership(leagueId, userId) {
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT member_role, joined_at
     FROM league_members
     WHERE league_id = :leagueId AND user_id = :userId
     LIMIT 1`,
    { leagueId, userId },
  )
  return rows[0] || null
}

export async function requireMembership(leagueId, userId) {
  const membership = await getMembership(leagueId, userId)
  if (!membership) {
    const error = new Error('You are not a member of this league')
    error.status = 403
    throw error
  }
  return membership
}

export async function requireCommissioner(leagueId, userId) {
  const pool = getPool()
  const [leagues] = await pool.query(
    `SELECT id, commissioner_user_id FROM leagues WHERE id = :leagueId LIMIT 1`,
    { leagueId },
  )
  if (!leagues[0]) {
    const error = new Error('League not found')
    error.status = 404
    throw error
  }

  const membership = await getMembership(leagueId, userId)
  const isCommissioner =
    leagues[0].commissioner_user_id === userId ||
    membership?.member_role === 'commissioner'

  if (!isCommissioner) {
    const error = new Error('Only the league commissioner can perform this action')
    error.status = 403
    throw error
  }

  return { league: leagues[0], membership }
}

export async function createLeague({
  name,
  description = null,
  competitionCode,
  commissionerUserId,
  scoringRules,
}) {
  const trimmedName = String(name || '').trim()
  if (!trimmedName || trimmedName.length > 120) {
    const error = new Error('League name is required (max 120 characters)')
    error.status = 400
    throw error
  }

  const trimmedDescription =
    description == null ? null : String(description).trim().slice(0, 500) || null
  const rules = normalizeScoringInput(scoringRules)
  const normalizedCompetition = normalizeCompetitionCode(competitionCode)

  const pool = getPool()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const slug = await allocateUniqueSlug(connection, trimmedName)
    const inviteCode = await allocateUniqueInviteCode(connection)

    const [result] = await connection.query(
      `INSERT INTO leagues (
         name, slug, description, commissioner_user_id, invite_code,
         competition_code, is_default
       )
       VALUES (
         :name, :slug, :description, :commissionerUserId, :inviteCode,
         :competitionCode, 0
       )`,
      {
        name: trimmedName,
        slug,
        description: trimmedDescription,
        commissionerUserId,
        inviteCode,
        competitionCode: normalizedCompetition,
      },
    )

    const leagueId = result.insertId
    await insertScoringRules(connection, leagueId, rules)
    await connection.query(
      `INSERT INTO league_members (league_id, user_id, member_role)
       VALUES (:leagueId, :userId, 'commissioner')`,
      { leagueId, userId: commissionerUserId },
    )

    await connection.commit()

    return getLeagueById(leagueId, {
      viewerUserId: commissionerUserId,
      includeMembers: true,
    })
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

export async function listLeaguesForUser(userId) {
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT l.*,
            m.member_role,
            r.points_exact_score,
            r.points_correct_outcome,
            r.points_correct_home_goals,
            r.points_correct_away_goals,
            r.updated_at AS rules_updated_at
     FROM league_members m
     INNER JOIN leagues l ON l.id = m.league_id
     INNER JOIN league_scoring_rules r ON r.league_id = l.id
     WHERE m.user_id = :userId
     ORDER BY l.is_default DESC, l.created_at DESC`,
    { userId },
  )

  return rows.map((row) => {
    const isCommissioner =
      row.commissioner_user_id === userId || row.member_role === 'commissioner'
    return {
      ...mapLeague(row, { includeInviteCode: isCommissioner }),
      memberRole: row.member_role,
      scoringRules: {
        pointsExactScore: row.points_exact_score,
        pointsCorrectOutcome: row.points_correct_outcome,
        pointsCorrectHomeGoals: row.points_correct_home_goals,
        pointsCorrectAwayGoals: row.points_correct_away_goals,
        updatedAt: row.rules_updated_at,
      },
    }
  })
}

async function loadLeagueMembers(leagueId) {
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT m.user_id, m.member_role, m.joined_at,
            u.first_name, u.last_name, u.screen_name, u.email
     FROM league_members m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.league_id = :leagueId
     ORDER BY m.member_role = 'commissioner' DESC, m.joined_at ASC`,
    { leagueId },
  )

  return rows.map((row) => ({
    userId: row.user_id,
    memberRole: row.member_role,
    joinedAt: row.joined_at,
    firstName: row.first_name,
    lastName: row.last_name,
    screenName: row.screen_name,
    displayName:
      row.screen_name ||
      [row.first_name, row.last_name].filter(Boolean).join(' ') ||
      row.email,
  }))
}

export async function getLeagueById(
  leagueId,
  { viewerUserId = null, includeMembers = false } = {},
) {
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
     WHERE l.id = :leagueId
     LIMIT 1`,
    { leagueId },
  )
  if (!rows[0]) return null

  const row = rows[0]
  const membership = viewerUserId ? await getMembership(leagueId, viewerUserId) : null
  const isCommissioner =
    Boolean(viewerUserId) &&
    (row.commissioner_user_id === viewerUserId ||
      membership?.member_role === 'commissioner')

  const league = {
    ...mapLeague(row, { includeInviteCode: isCommissioner }),
    scoringRules: {
      pointsExactScore: row.points_exact_score,
      pointsCorrectOutcome: row.points_correct_outcome,
      pointsCorrectHomeGoals: row.points_correct_home_goals,
      pointsCorrectAwayGoals: row.points_correct_away_goals,
      updatedAt: row.rules_updated_at,
    },
    memberRole: membership?.member_role || null,
  }

  if (includeMembers) {
    league.members = await loadLeagueMembers(leagueId)
  }

  return league
}

export async function getLeagueBySlug(
  slug,
  { viewerUserId = null, includeMembers = false } = {},
) {
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT id FROM leagues WHERE slug = :slug LIMIT 1`,
    { slug },
  )
  if (!rows[0]) return null
  return getLeagueById(rows[0].id, { viewerUserId, includeMembers })
}

export async function joinLeagueByInviteCode(inviteCode, userId, userEmail = null) {
  const code = String(inviteCode || '')
    .trim()
    .toUpperCase()
  if (!code) {
    const error = new Error('Invite code is required')
    error.status = 400
    throw error
  }

  const pool = getPool()
  const [leagues] = await pool.query(
    `SELECT id FROM leagues WHERE invite_code = :inviteCode LIMIT 1`,
    { inviteCode: code },
  )
  if (!leagues[0]) {
    const error = new Error('Invalid invite code')
    error.status = 404
    throw error
  }

  const leagueId = leagues[0].id
  const existing = await getMembership(leagueId, userId)
  if (!existing) {
    await ensureLeagueMembership(leagueId, userId, 'member')
  }

  if (userEmail) {
    await pool.query(
      `UPDATE league_invites
       SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
       WHERE league_id = :leagueId
         AND email = :email
         AND status = 'pending'`,
      { leagueId, email: String(userEmail).trim().toLowerCase() },
    )
  }

  return getLeagueById(leagueId, { viewerUserId: userId, includeMembers: true })
}

export async function regenerateInviteCode(leagueId, userId) {
  await requireCommissioner(leagueId, userId)
  const pool = getPool()
  const inviteCode = await allocateUniqueInviteCode(pool)
  await pool.query(
    `UPDATE leagues SET invite_code = :inviteCode WHERE id = :leagueId`,
    { leagueId, inviteCode },
  )
  await pool.query(
    `UPDATE league_invites
     SET invite_code = :inviteCode
     WHERE league_id = :leagueId AND status = 'pending'`,
    { leagueId, inviteCode },
  )
  return inviteCode
}

/**
 * Permanently delete a private league and cascaded members/picks/invites/rules.
 * The default open league cannot be deleted.
 */
export async function deleteLeague(leagueId, userId) {
  await requireCommissioner(leagueId, userId)

  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT id, name, slug, is_default FROM leagues WHERE id = :leagueId LIMIT 1`,
    { leagueId },
  )
  if (!rows[0]) {
    const error = new Error('League not found')
    error.status = 404
    throw error
  }
  if (rows[0].is_default) {
    const error = new Error('The default open league cannot be deleted')
    error.status = 403
    throw error
  }

  await pool.query(`DELETE FROM leagues WHERE id = :leagueId`, { leagueId })

  return {
    id: rows[0].id,
    name: rows[0].name,
    slug: rows[0].slug,
  }
}

export async function createEmailInvite({
  leagueId,
  invitedByUserId,
  email,
}) {
  await requireCommissioner(leagueId, invitedByUserId)

  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    const error = new Error('A valid email address is required')
    error.status = 400
    throw error
  }

  const league = await getLeagueById(leagueId, {
    viewerUserId: invitedByUserId,
  })
  if (!league?.inviteCode) {
    const error = new Error('League invite code is missing')
    error.status = 500
    throw error
  }

  const pool = getPool()
  await pool.query(
    `INSERT INTO league_invites (
       league_id, email, invited_by_user_id, invite_code, status
     ) VALUES (
       :leagueId, :email, :invitedByUserId, :inviteCode, 'pending'
     )
     ON DUPLICATE KEY UPDATE
       invited_by_user_id = VALUES(invited_by_user_id),
       invite_code = VALUES(invite_code),
       status = 'pending',
       accepted_at = NULL,
       created_at = CURRENT_TIMESTAMP`,
    {
      leagueId,
      email: normalizedEmail,
      invitedByUserId,
      inviteCode: league.inviteCode,
    },
  )

  return {
    league,
    email: normalizedEmail,
    inviteCode: league.inviteCode,
  }
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

export async function getLeagueStandings(leagueId) {
  const league = await getLeagueById(leagueId)
  if (!league) {
    const error = new Error('League not found')
    error.status = 404
    throw error
  }

  const rules = await getLeagueScoringRules(leagueId)
  const members = await loadLeagueMembers(leagueId)
  const pool = getPool()

  const [predictions] = await pool.query(
    `SELECT p.user_id,
            p.external_match_id,
            p.predicted_home_score,
            p.predicted_away_score,
            f.home_score,
            f.away_score,
            f.status
     FROM match_predictions p
     LEFT JOIN fixtures f ON f.external_match_id = p.external_match_id
     WHERE p.league_id = :leagueId
       AND p.competition_code = :competitionCode`,
    { leagueId, competitionCode: league.competitionCode },
  )

  const byUser = new Map(
    members.map((member) => [
      member.userId,
      {
        userId: member.userId,
        displayName: member.displayName,
        memberRole: member.memberRole,
        points: 0,
        scoredPicks: 0,
        totalPicks: 0,
      },
    ]),
  )

  for (const row of predictions) {
    const entry = byUser.get(row.user_id)
    if (!entry) continue
    entry.totalPicks += 1

    if (!FINISHED_STATUSES.has(String(row.status || '').toUpperCase())) {
      continue
    }
    if (row.home_score == null || row.away_score == null) continue

    const result = scorePrediction(
      { home: row.predicted_home_score, away: row.predicted_away_score },
      { home: row.home_score, away: row.away_score },
      rules,
    )
    entry.points += result.points
    entry.scoredPicks += 1
  }

  return {
    scoringRules: rules,
    standings: [...byUser.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return a.displayName.localeCompare(b.displayName)
    }),
  }
}

export function buildJoinUrl(inviteCode) {
  const origins = (
    process.env.CLIENT_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const base = origins[0] || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/leagues/join/${encodeURIComponent(inviteCode)}`
}

export async function resolveLeagueIdForUser(leagueIdOrNull, userId) {
  if (leagueIdOrNull == null || leagueIdOrNull === '') {
    const league = await getDefaultLeague()
    await ensureLeagueMembership(league.id, userId)
    return league.id
  }

  const leagueId = Number(leagueIdOrNull)
  if (!Number.isInteger(leagueId) || leagueId < 1) {
    const error = new Error('Invalid leagueId')
    error.status = 400
    throw error
  }

  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT id FROM leagues WHERE id = :leagueId LIMIT 1`,
    { leagueId },
  )
  if (!rows[0]) {
    const error = new Error('League not found')
    error.status = 404
    throw error
  }

  await requireMembership(leagueId, userId)
  return leagueId
}
