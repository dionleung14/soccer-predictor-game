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

async function ensureDatabase() {
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
    throw new Error('DB_NAME and DB_USERNAME_ROOT are required to initialize MySQL')
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
