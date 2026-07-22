import { Navigate, useParams } from 'react-router-dom'
import CompetitionMatches from '../components/CompetitionMatches'
import { getCompetitionByPathSegment } from '../competitions'

export default function CompetitionPage() {
  const { competitionSlug } = useParams()
  const competition = getCompetitionByPathSegment(competitionSlug)

  if (!competition) {
    return <Navigate to="/competitions/world-cup" replace />
  }

  return <CompetitionMatches key={competition.code} competition={competition} />
}
