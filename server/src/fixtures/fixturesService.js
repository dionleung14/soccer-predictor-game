import { getPool } from '../db/pool.js'
import {
  CACHED_COMPETITION_CODES,
  SYNC_STALE_AFTER_HOURS,
  isCachedCompetition,
  mapUpstreamMatch,
  toApiMatch,
} from './competitionCodes.js'

const FOOTBALL_API_BASE = 'https://api.football-data.org'

async function ensureSyncRow(competitionCode, connection = null) {
  const db = connection || getPool()
  await db.query(
    `INSERT IGNORE INTO competition_sync_state (competition_code)
     VALUES (:competitionCode)`,
    { competitionCode: String(competitionCode).toUpperCase() },
  )
}

export async function listFixturesFromDb(competitionCode) {
  const code = String(competitionCode).toUpperCase()
  if (!isCachedCompetition(code)) {
    throw new Error(`Competition ${code} is not configured for local caching`)
  }

  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT *
     FROM fixtures
     WHERE competition_code = :code
     ORDER BY kickoff_at IS NULL, kickoff_at ASC, external_match_id ASC`,
    { code },
  )

  return rows.map(toApiMatch)
}

export async function getSyncStatus(competitionCode) {
  const code = String(competitionCode).toUpperCase()
  await ensureSyncRow(code)
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT competition_code AS competitionCode,
            last_synced_at AS lastSyncedAt,
            last_sync_status AS lastSyncStatus,
            last_sync_error AS lastSyncError,
            match_count AS matchCount,
            updated_at AS updatedAt
     FROM competition_sync_state
     WHERE competition_code = :code
     LIMIT 1`,
    { code },
  )
  return rows[0] || null
}

export function isSyncStale(syncStatus, now = new Date()) {
  if (!syncStatus?.lastSyncedAt) return true
  if (syncStatus.lastSyncStatus !== 'ok') return true
  const ageMs = now.getTime() - new Date(syncStatus.lastSyncedAt).getTime()
  return ageMs >= SYNC_STALE_AFTER_HOURS * 60 * 60 * 1000
}

/**
 * Future hook for once-daily refresh while a tournament is in progress.
 * Currently returns whether a refresh would be warranted; auto-refresh is not enabled yet.
 */
export async function shouldRefreshFromApi(competitionCode) {
  const status = await getSyncStatus(competitionCode)
  return {
    shouldRefresh: isSyncStale(status),
    reason: !status?.lastSyncedAt
      ? 'never_synced'
      : status.lastSyncStatus !== 'ok'
        ? 'last_sync_failed'
        : isSyncStale(status)
          ? 'stale'
          : 'fresh',
    staleAfterHours: SYNC_STALE_AFTER_HOURS,
    syncStatus: status,
  }
}

async function fetchUpstreamMatches(competitionCode) {
  const token = process.env.FOOTBALL_DATA_API_TOKEN
  if (!token) {
    throw new Error('FOOTBALL_DATA_API_TOKEN is not configured on the server')
  }

  const code = String(competitionCode).toUpperCase()
  const url = `${FOOTBALL_API_BASE}/v4/competitions/${code}/matches`
  const upstream = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Auth-Token': token,
    },
  })

  const body = await upstream.json().catch(() => ({}))
  if (!upstream.ok) {
    const detail = body.message || body.error || `HTTP ${upstream.status}`
    throw new Error(`Upstream fixtures sync failed for ${code}: ${detail}`)
  }

  return Array.isArray(body.matches) ? body.matches : []
}

export async function syncCompetitionFixtures(competitionCode) {
  const code = String(competitionCode).toUpperCase()
  if (!isCachedCompetition(code)) {
    throw new Error(`Competition ${code} is not configured for local caching`)
  }

  await ensureSyncRow(code)
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    const upstreamMatches = await fetchUpstreamMatches(code)
    const mapped = upstreamMatches.map((match) => mapUpstreamMatch(match, code))

    await connection.beginTransaction()

    for (const fixture of mapped) {
      await connection.query(
        `INSERT INTO fixtures (
           external_match_id, competition_code, season_start_year, status, stage, matchday,
           kickoff_at, home_team_id, home_team_name, home_team_crest,
           away_team_id, away_team_name, away_team_crest, home_score, away_score
         ) VALUES (
           :externalMatchId, :competitionCode, :seasonStartYear, :status, :stage, :matchday,
           :kickoffAt, :homeTeamId, :homeTeamName, :homeTeamCrest,
           :awayTeamId, :awayTeamName, :awayTeamCrest, :homeScore, :awayScore
         )
         ON DUPLICATE KEY UPDATE
           competition_code = VALUES(competition_code),
           season_start_year = VALUES(season_start_year),
           status = VALUES(status),
           stage = VALUES(stage),
           matchday = VALUES(matchday),
           kickoff_at = VALUES(kickoff_at),
           home_team_id = VALUES(home_team_id),
           home_team_name = VALUES(home_team_name),
           home_team_crest = VALUES(home_team_crest),
           away_team_id = VALUES(away_team_id),
           away_team_name = VALUES(away_team_name),
           away_team_crest = VALUES(away_team_crest),
           home_score = VALUES(home_score),
           away_score = VALUES(away_score)`,
        fixture,
      )
    }

    await connection.query(
      `UPDATE competition_sync_state
       SET last_synced_at = CURRENT_TIMESTAMP,
           last_sync_status = 'ok',
           last_sync_error = NULL,
           match_count = :matchCount
       WHERE competition_code = :code`,
      { code, matchCount: mapped.length },
    )

    await connection.commit()

    return {
      competitionCode: code,
      synced: mapped.length,
      lastSyncedAt: new Date().toISOString(),
    }
  } catch (err) {
    await connection.rollback()
    await pool.query(
      `UPDATE competition_sync_state
       SET last_sync_status = 'error',
           last_sync_error = :error
       WHERE competition_code = :code`,
      {
        code,
        error: String(err instanceof Error ? err.message : err).slice(0, 500),
      },
    )
    throw err
  } finally {
    connection.release()
  }
}

export async function syncAllCachedCompetitions() {
  const results = []
  for (const code of CACHED_COMPETITION_CODES) {
    results.push(await syncCompetitionFixtures(code))
  }
  return results
}

/**
 * Serve fixtures from DB. If the cache is empty, bootstrap once from the API.
 * Daily in-progress refresh can later call sync when shouldRefreshFromApi() is true.
 */
export async function getCompetitionMatches(competitionCode, { bootstrapIfEmpty = true } = {}) {
  const code = String(competitionCode).toUpperCase()
  let matches = await listFixturesFromDb(code)
  let synced = false

  if (bootstrapIfEmpty && matches.length === 0) {
    await syncCompetitionFixtures(code)
    matches = await listFixturesFromDb(code)
    synced = true
  }

  const syncStatus = await getSyncStatus(code)
  const refreshHint = await shouldRefreshFromApi(code)

  return {
    competitionCode: code,
    source: 'database',
    syncedOnRead: synced,
    // Placeholder for future auto daily refresh while tournament is live.
    refreshHint,
    syncStatus,
    count: matches.length,
    matches,
  }
}

export async function ensureCompetitionSyncRows(connection = null) {
  for (const code of CACHED_COMPETITION_CODES) {
    await ensureSyncRow(code, connection)
  }
}
