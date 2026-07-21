import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { getPool } from '../db/pool.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { mapUser, normalizeEmail } from '../users/userMapper.js'
import { requireAuth } from '../middleware/requireAuth.js'

export const authRouter = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
})

/** Used so missing users still run a password verify (timing-ish hardening). */
const dummyHashPromise = hashPassword('timing-safe-dummy-value-not-a-real-account')

authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}

    if (!email || password == null) {
      res.status(400).json({ error: 'email and password are required' })
      return
    }

    const normalizedEmail = normalizeEmail(email)
    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, screen_name, email, password_hash, roles, created_at, updated_at
       FROM users
       WHERE email = :email
       LIMIT 1`,
      { email: normalizedEmail },
    )

    const user = rows[0]
    const hashToCheck = user?.password_hash || (await dummyHashPromise)
    const passwordOk = await verifyPassword(hashToCheck, String(password))

    if (!user || !passwordOk) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    })

    req.session.userId = user.id
    const publicUser = mapUser(user)

    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()))
    })

    res.json({ user: publicUser })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/logout', (req, res, next) => {
  if (!req.session) {
    res.json({ ok: true })
    return
  }

  req.session.destroy((err) => {
    if (err) {
      next(err)
      return
    }
    res.clearCookie('spg.sid')
    res.json({ ok: true })
  })
})

authRouter.get('/me', async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, screen_name, email, roles, created_at, updated_at
       FROM users
       WHERE id = :id
       LIMIT 1`,
      { id: req.session.userId },
    )

    if (!rows[0]) {
      await new Promise((resolve) => {
        req.session.destroy(() => resolve())
      })
      res.clearCookie('spg.sid')
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    res.json({ user: mapUser(rows[0]) })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/welcome', requireAuth, (req, res) => {
  res.json({
    message: 'Thank you for signing in',
    userId: req.session.userId,
  })
})
