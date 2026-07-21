import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { getPool } from '../db/pool.js'
import { hashPassword, validatePassword } from '../auth/password.js'
import { mapUser, normalizeEmail } from '../users/userMapper.js'

export const usersRouter = Router()

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signup attempts. Please try again later.' },
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

usersRouter.get('/', async (_req, res, next) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, screen_name, email, roles, created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    res.json({ users: rows.map(mapUser) })
  } catch (err) {
    next(err)
  }
})

usersRouter.post('/signup', signupLimiter, async (req, res, next) => {
  try {
    const { firstName, lastName, screenName, email, password } = req.body ?? {}

    if (!firstName || !lastName || !email || password == null) {
      res.status(400).json({
        error: 'firstName, lastName, email, and password are required',
      })
      return
    }

    const normalizedEmail = normalizeEmail(email)
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      res.status(400).json({ error: 'A valid email address is required' })
      return
    }

    const passwordError = validatePassword(password, { email: normalizedEmail })
    if (passwordError) {
      res.status(400).json({ error: passwordError })
      return
    }

    const roles = ['player']
    const passwordHash = await hashPassword(password)

    const pool = getPool()
    const [result] = await pool.query(
      `INSERT INTO users (first_name, last_name, screen_name, email, password_hash, roles)
       VALUES (:firstName, :lastName, :screenName, :email, :passwordHash, CAST(:roles AS JSON))`,
      {
        firstName: String(firstName).slice(0, 100),
        lastName: String(lastName).slice(0, 100),
        screenName: screenName ? String(screenName).slice(0, 100) : null,
        email: normalizedEmail,
        passwordHash,
        roles: JSON.stringify(roles),
      },
    )

    res.status(201).json({
      id: result.insertId,
      firstName: String(firstName).slice(0, 100),
      lastName: String(lastName).slice(0, 100),
      screenName: screenName ? String(screenName).slice(0, 100) : null,
      email: normalizedEmail,
      roles,
    })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'A user with that email or screen name already exists' })
      return
    }
    next(err)
  }
})
