export const CACHED_COMPETITION_CODES = ['WC', 'PL', 'EC']

/** Hours after which a sync is considered stale (future daily refresh). */
export const SYNC_STALE_AFTER_HOURS = Number(
  process.env.FIXTURES_SYNC_STALE_HOURS || 24,
)

export function isCachedCompetition(code) {
  return CACHED_COMPETITION_CODES.includes(String(code || '').toUpperCase())
}

export function toApiMatch(row) {
  return {
    id: row.external_match_id,
    utcDate: row.kickoff_at ? new Date(row.kickoff_at).toISOString() : null,
    status: row.status,
    stage: row.stage,
    matchday: row.matchday,
    competition: {
      code: row.competition_code,
    },
    homeTeam: {
      id: row.home_team_id,
      name: row.home_team_name,
      crest: row.home_team_crest,
    },
    awayTeam: {
      id: row.away_team_id,
      name: row.away_team_name,
      crest: row.away_team_crest,
    },
    score: {
      fullTime: {
        home: row.home_score,
        away: row.away_score,
      },
    },
  }
}

export function mapUpstreamMatch(match, competitionCode) {
  const seasonStart = match.season?.startDate
    ? Number(String(match.season.startDate).slice(0, 4))
    : null

  return {
    externalMatchId: match.id,
    competitionCode: String(competitionCode).toUpperCase(),
    seasonStartYear: Number.isFinite(seasonStart) ? seasonStart : null,
    status: match.status || 'SCHEDULED',
    stage: match.stage || null,
    matchday: match.matchday ?? null,
    kickoffAt: match.utcDate ? new Date(match.utcDate) : null,
    homeTeamId: match.homeTeam?.id ?? null,
    homeTeamName: match.homeTeam?.name || match.homeTeam?.shortName || 'TBD',
    homeTeamCrest: match.homeTeam?.crest || null,
    awayTeamId: match.awayTeam?.id ?? null,
    awayTeamName: match.awayTeam?.name || match.awayTeam?.shortName || 'TBD',
    awayTeamCrest: match.awayTeam?.crest || null,
    homeScore: match.score?.fullTime?.home ?? null,
    awayScore: match.score?.fullTime?.away ?? null,
  }
}
