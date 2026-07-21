import { Router } from 'express'
import { getPool } from '../db/pool.js'

export const usersRouter = Router()

function parseRoles(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function mapUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    screenName: row.screen_name,
    email: row.email,
    roles: parseRoles(row.roles),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return ['player']
  }
  if (!roles.every((role) => typeof role === 'string' && role.trim())) {
    return null
  }
  return [...new Set(roles.map((role) => role.trim()))]
}

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

usersRouter.post('/', async (req, res, next) => {
  try {
    const { firstName, lastName, screenName, email, roles } = req.body ?? {}

    if (!firstName || !lastName || !email) {
      res.status(400).json({
        error: 'firstName, lastName, and email are required',
      })
      return
    }

    const normalizedRoles = normalizeRoles(roles)
    if (!normalizedRoles) {
      res.status(400).json({
        error: 'roles must be an array of non-empty strings when provided',
      })
      return
    }

    const pool = getPool()
    const [result] = await pool.query(
      `INSERT INTO users (first_name, last_name, screen_name, email, roles)
       VALUES (:firstName, :lastName, :screenName, :email, CAST(:roles AS JSON))`,
      {
        firstName: String(firstName).slice(0, 100),
        lastName: String(lastName).slice(0, 100),
        screenName: screenName ? String(screenName).slice(0, 100) : null,
        email: String(email).trim().toLowerCase().slice(0, 255),
        roles: JSON.stringify(normalizedRoles),
      },
    )

    res.status(201).json({
      id: result.insertId,
      firstName: String(firstName).slice(0, 100),
      lastName: String(lastName).slice(0, 100),
      screenName: screenName ? String(screenName).slice(0, 100) : null,
      email: String(email).trim().toLowerCase().slice(0, 255),
      roles: normalizedRoles,
    })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'A user with that email or screen name already exists' })
      return
    }
    next(err)
  }
})
