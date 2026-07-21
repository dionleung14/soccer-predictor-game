import mysql from 'mysql2/promise'

function connectionConfigFromUrl(databaseUrl) {
  const parsed = new URL(databaseUrl)
  const database = parsed.pathname.replace(/^\//, '').split('?')[0]

  const sslParam = parsed.searchParams.get('ssl')
  const wantsSsl =
    process.env.MYSQL_SSL === 'true' ||
    (process.env.MYSQL_SSL !== 'false' &&
      (sslParam === 'true' || process.env.NODE_ENV === 'production'))

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 5),
    namedPlaceholders: true,
    ...(wantsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  }
}

function connectionConfigFromDiscreteEnv() {
  const {
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
  } = process.env

  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) {
    return null
  }

  return {
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT || 3306),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD || '',
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 5),
    namedPlaceholders: true,
    ...(process.env.MYSQL_SSL === 'true'
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  }
}

/**
 * Resolves MySQL config for local docker-compose and Heroku add-ons
 * (JAWSDB_URL / CLEARDB_DATABASE_URL / DATABASE_URL).
 */
export function resolveMysqlConfig() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.JAWSDB_URL ||
    process.env.CLEARDB_DATABASE_URL ||
    process.env.MYSQL_URL

  if (databaseUrl) {
    return connectionConfigFromUrl(databaseUrl)
  }

  return connectionConfigFromDiscreteEnv()
}

let pool = null

export function getPool() {
  if (pool) return pool

  const config = resolveMysqlConfig()
  if (!config) {
    throw new Error(
      'MySQL is not configured. Set DATABASE_URL (or JAWSDB_URL / CLEARDB_DATABASE_URL) or MYSQL_HOST/USER/DATABASE.',
    )
  }

  pool = mysql.createPool(config)
  return pool
}

export async function checkDatabase() {
  const db = getPool()
  const [rows] = await db.query('SELECT 1 AS ok')
  return rows[0]?.ok === 1
}

export async function closePool() {
  if (!pool) return
  await pool.end()
  pool = null
}
