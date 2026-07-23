import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { getPool } from '../db/pool.js'
import { sendLeagueInviteEmail } from '../email/mailer.js'
import {
  buildJoinUrl,
  createEmailInvite,
  createLeague,
  getDefaultLeague,
  getLeagueBySlug,
  getLeagueStandings,
  getLeagueScoringRules,
  ensureDefaultLeague,
  ensureLeagueMembership,
  joinLeagueByInviteCode,
  listLeaguesForUser,
  regenerateInviteCode,
  requireCommissioner,
  requireMembership,
} from '../leagues/leagueService.js'

export const leaguesRouter = Router()

async function getUserEmail(userId) {
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT email, first_name, last_name, screen_name
     FROM users WHERE id = :userId LIMIT 1`,
    { userId },
  )
  return rows[0] || null
}

leaguesRouter.get('/default', async (_req, res, next) => {
  try {
    const league = await getDefaultLeague()
    res.json({ league })
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

leaguesRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    await ensureDefaultLeague()
    const leagues = await listLeaguesForUser(req.session.userId)
    res.json({ leagues })
  } catch (err) {
    next(err)
  }
})

leaguesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, description, scoringRules } = req.body ?? {}
    const league = await createLeague({
      name,
      description,
      commissionerUserId: req.session.userId,
      scoringRules,
    })
    res.status(201).json({ league })
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

leaguesRouter.post('/join/:inviteCode', requireAuth, async (req, res, next) => {
  try {
    const user = await getUserEmail(req.session.userId)
    const league = await joinLeagueByInviteCode(
      req.params.inviteCode,
      req.session.userId,
      user?.email,
    )
    res.json({ league, joined: true })
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

leaguesRouter.get('/:slug', requireAuth, async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim()
    const league = await getLeagueBySlug(slug, {
      viewerUserId: req.session.userId,
      includeMembers: true,
    })
    if (!league) {
      res.status(404).json({ error: 'League not found' })
      return
    }

    await requireMembership(league.id, req.session.userId)
    res.json({ league })
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

leaguesRouter.get('/:leagueId/standings', requireAuth, async (req, res, next) => {
  try {
    const leagueId = Number(req.params.leagueId)
    if (!Number.isInteger(leagueId) || leagueId < 1) {
      res.status(400).json({ error: 'Invalid league id' })
      return
    }

    await requireMembership(leagueId, req.session.userId)
    const payload = await getLeagueStandings(leagueId)
    res.json({ leagueId, ...payload })
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

leaguesRouter.post('/:leagueId/invites', requireAuth, async (req, res, next) => {
  try {
    const leagueId = Number(req.params.leagueId)
    if (!Number.isInteger(leagueId) || leagueId < 1) {
      res.status(400).json({ error: 'Invalid league id' })
      return
    }

    const { email } = req.body ?? {}
    const invite = await createEmailInvite({
      leagueId,
      invitedByUserId: req.session.userId,
      email,
    })

    const inviter = await getUserEmail(req.session.userId)
    const inviterName =
      inviter?.screen_name ||
      [inviter?.first_name, inviter?.last_name].filter(Boolean).join(' ') ||
      'A commissioner'
    const joinUrl = buildJoinUrl(invite.inviteCode)

    await sendLeagueInviteEmail({
      to: invite.email,
      leagueName: invite.league.name,
      inviterName,
      joinUrl,
    })

    res.status(201).json({
      invite: {
        email: invite.email,
        inviteCode: invite.inviteCode,
        joinUrl,
        status: 'pending',
      },
    })
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    if (err.name === 'EmailSendError') {
      res.status(502).json({ error: err.message })
      return
    }
    next(err)
  }
})

leaguesRouter.post(
  '/:leagueId/regenerate-invite',
  requireAuth,
  async (req, res, next) => {
    try {
      const leagueId = Number(req.params.leagueId)
      if (!Number.isInteger(leagueId) || leagueId < 1) {
        res.status(400).json({ error: 'Invalid league id' })
        return
      }

      const inviteCode = await regenerateInviteCode(leagueId, req.session.userId)
      res.json({
        inviteCode,
        joinUrl: buildJoinUrl(inviteCode),
      })
    } catch (err) {
      if (err.status) {
        res.status(err.status).json({ error: err.message })
        return
      }
      next(err)
    }
  },
)

/**
 * Future commissioner endpoint: update scoring knobs for a league you own.
 * Wired now so league tooling can land without schema churn.
 */
leaguesRouter.patch('/:leagueId/scoring-rules', requireAuth, async (req, res, next) => {
  try {
    const leagueId = Number(req.params.leagueId)
    const userId = req.session.userId
    const pool = getPool()

    await requireCommissioner(leagueId, userId)

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
    if (err.status) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})
