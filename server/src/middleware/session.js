import session from 'express-session'
import MySQLStoreFactory from 'express-mysql-session'
import { resolveMysqlConfig } from '../db/pool.js'

const MySQLStore = MySQLStoreFactory(session)

export function createSessionMiddleware() {
  const isProd = process.env.NODE_ENV === 'production'
  const secret = process.env.SESSION_SECRET

  if (!secret) {
    if (isProd) {
      throw new Error('SESSION_SECRET must be set in production')
    }
    console.warn(
      'Warning: SESSION_SECRET is not set. Using an insecure development default.',
    )
  }

  const dbConfig = resolveMysqlConfig()
  if (!dbConfig) {
    throw new Error('MySQL must be configured before enabling sessions')
  }

  const store = new MySQLStore({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 7 * 24 * 60 * 60 * 1000,
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
    ...(dbConfig.ssl ? { ssl: dbConfig.ssl } : {}),
  })

  return session({
    name: 'spg.sid',
    secret: secret || 'dev-only-insecure-session-secret',
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
}
