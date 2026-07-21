import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import dotenv from 'dotenv'
import { getPool, closePool } from './pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const MIGRATION_NAME = '001_initial_schema'

async function migrate() {
  const pool = getPool()
  const schemaSql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8')

  const statements = schemaSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    for (const statement of statements) {
      await connection.query(statement)
    }

    await connection.query(
      `INSERT IGNORE INTO schema_migrations (name) VALUES (:name)`,
      { name: MIGRATION_NAME },
    )

    await connection.commit()
    console.log(`Migration applied: ${MIGRATION_NAME}`)
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
