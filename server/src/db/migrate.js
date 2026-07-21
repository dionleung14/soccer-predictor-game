import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import dotenv from 'dotenv'
import { getPool, closePool } from './pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function ensureBaseSchema(connection) {
  const schemaSql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8')
  const statements = schemaSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await connection.query(statement)
  }

  await connection.query(
    `INSERT IGNORE INTO schema_migrations (name) VALUES (:name)`,
    { name: '002_users_table' },
  )
}

async function ensurePasswordHashColumn(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'password_hash'`,
  )

  if (Number(rows[0].cnt) > 0) {
    await connection.query(
      `INSERT IGNORE INTO schema_migrations (name) VALUES (:name)`,
      { name: '003_users_password_hash' },
    )
    return
  }

  await connection.query(
    `ALTER TABLE users
     ADD COLUMN password_hash VARCHAR(255) NULL AFTER email`,
  )

  const [userCount] = await connection.query(`SELECT COUNT(*) AS cnt FROM users`)
  if (Number(userCount[0].cnt) === 0) {
    await connection.query(
      `ALTER TABLE users
       MODIFY COLUMN password_hash VARCHAR(255) NOT NULL`,
    )
  }

  await connection.query(
    `INSERT IGNORE INTO schema_migrations (name) VALUES (:name)`,
    { name: '003_users_password_hash' },
  )
  console.log('Migration applied: 003_users_password_hash')
}

async function migrate() {
  const pool = getPool()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await ensureBaseSchema(connection)
    await ensurePasswordHashColumn(connection)
    await connection.commit()
    console.log('Migrations up to date')
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

const isCli =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isCli) {
  migrate()
    .then(() => closePool())
    .then(() => {
      process.exit(0)
    })
    .catch((err) => {
      console.error('Migration failed:', err)
      closePool().finally(() => process.exit(1))
    })
}

export { migrate }
