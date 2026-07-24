/** football-data.org competition codes and display metadata */
export const COMPETITIONS = [
  {
    code: 'WC',
    name: 'World Cup',
    shortName: 'World Cup',
    path: '/competitions/world-cup',
    description: 'Predict final scores for FIFA World Cup fixtures.',
    emblem: 'https://crests.football-data.org/qatar.png',
  },
  {
    code: 'PL',
    name: 'Premier League',
    shortName: 'Premier League',
    path: '/competitions/premier-league',
    description: 'Predict final scores for English Premier League fixtures.',
    emblem: 'https://crests.football-data.org/PL.png',
  },
  {
    code: 'EC',
    name: 'European Championship',
    shortName: 'Euro',
    path: '/competitions/euro',
    description: 'Predict final scores for UEFA European Championship fixtures.',
    emblem: 'https://crests.football-data.org/2024.png',
  },
]

export function getCompetitionByPathSegment(segment) {
  const map = {
    'world-cup': 'WC',
    'premier-league': 'PL',
    euro: 'EC',
  }
  const code = map[segment]
  return COMPETITIONS.find((c) => c.code === code) || null
}

export function getCompetitionByCode(code) {
  return COMPETITIONS.find((c) => c.code === code) || null
}
