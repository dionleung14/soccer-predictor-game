import mysql from 'mysql2/promise'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

function stripQuotes(value) {
  if (value == null) return value
  return String(value).trim().replace(/^['"]|['"]$/g, '')
}

function hasManagedDatabaseUrl() {
  return Boolean(
    process.env.JAWSDB_URL ||
      process.env.CLEARDB_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.MYSQL_URL,
  )
}

function shouldSkipLocalEnsure() {
  // Heroku sets DYNO on web/release dynos. Managed add-ons already provide a DB.
  return Boolean(process.env.DYNO) || hasManagedDatabaseUrl()
}

async function ensureDatabase() {
  if (shouldSkipLocalEnsure()) {
    console.log(
      'Skipping local CREATE DATABASE (Heroku dyno or managed database URL detected)',
    )
    return
  }

  const database = stripQuotes(process.env.DB_NAME || process.env.MYSQL_DATABASE)
  const user = stripQuotes(
    process.env.DB_USERNAME_ROOT ||
      process.env.DB_USERNAME ||
      process.env.MYSQL_USER,
  )
  const password = stripQuotes(
    process.env.DB_PASSWORD_ROOT ||
      process.env.DB_PASSWORD ||
      process.env.MYSQL_PASSWORD ||
      '',
  )
  const host = stripQuotes(process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1')
  const port = Number(stripQuotes(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'))

  if (!database || !user) {
    throw new Error(
      'DB_NAME and DB_USERNAME_ROOT are required for local MySQL init (or set JAWSDB_URL / DATABASE_URL on Heroku)',
    )
  }

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  })

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, '``')}\`
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci`,
    )
    console.log(`Database ensured: ${database}`)
  } finally {
    await connection.end()
  }
}

ensureDatabase().catch((err) => {
  console.error('Failed to ensure database:', err.message)
  process.exit(1)
})
