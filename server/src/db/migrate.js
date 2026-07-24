import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import dotenv from 'dotenv'
import { getPool, closePool } from './pool.js'
import {
  ensureDefaultLeague,
  generateInviteCode,
} from '../leagues/leagueService.js'
import { ensureCompetitionSyncRows } from '../fixtures/fixturesService.js'

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

async function ensureFantasyTablesSeeded(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM schema_migrations WHERE name = :name`,
    { name: '004_fantasy_leagues_predictions' },
  )
  if (Number(rows[0].cnt) > 0) {
    await ensureDefaultLeague(connection)
    return
  }

  await ensureDefaultLeague(connection)
  await connection.query(
    `INSERT IGNORE INTO schema_migrations (name) VALUES (:name)`,
    { name: '004_fantasy_leagues_predictions' },
  )
  console.log('Migration applied: 004_fantasy_leagues_predictions')
}

async function ensureFixturesCacheTables(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM schema_migrations WHERE name = :name`,
    { name: '005_fixtures_cache' },
  )
  if (Number(rows[0].cnt) > 0) {
    await ensureCompetitionSyncRows(connection)
    return
  }

  await ensureCompetitionSyncRows(connection)
  await connection.query(
    `INSERT IGNORE INTO schema_migrations (name) VALUES (:name)`,
    { name: '005_fixtures_cache' },
  )
  console.log('Migration applied: 005_fixtures_cache')
}

async function ensureLeagueInvites(connection) {
  const migrationName = '006_league_invites'
  const [applied] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM schema_migrations WHERE name = :name`,
    { name: migrationName },
  )
  if (Number(applied[0].cnt) > 0) {
    return
  }

  const [inviteCodeCol] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'leagues'
       AND COLUMN_NAME = 'invite_code'`,
  )
  if (Number(inviteCodeCol[0].cnt) === 0) {
    await connection.query(
      `ALTER TABLE leagues
       ADD COLUMN invite_code VARCHAR(32) NULL AFTER commissioner_user_id,
       ADD UNIQUE KEY uq_leagues_invite_code (invite_code)`,
    )
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS league_invites (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      league_id INT UNSIGNED NOT NULL,
      email VARCHAR(255) NOT NULL,
      invited_by_user_id INT UNSIGNED NOT NULL,
      invite_code VARCHAR(32) NOT NULL,
      status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accepted_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_league_invites_league_email (league_id, email),
      KEY idx_league_invites_code (invite_code),
      KEY idx_league_invites_email (email),
      CONSTRAINT fk_league_invites_league
        FOREIGN KEY (league_id) REFERENCES leagues (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_league_invites_invited_by
        FOREIGN KEY (invited_by_user_id) REFERENCES users (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [missingCodes] = await connection.query(
    `SELECT id FROM leagues WHERE invite_code IS NULL OR invite_code = ''`,
  )
  for (const row of missingCodes) {
    let assigned = false
    for (let attempt = 0; attempt < 10 && !assigned; attempt += 1) {
      const inviteCode = generateInviteCode()
      try {
        await connection.query(
          `UPDATE leagues SET invite_code = :inviteCode WHERE id = :id`,
          { inviteCode, id: row.id },
        )
        assigned = true
      } catch {
        // Unique collision; retry with a new code.
      }
    }
  }

  await connection.query(
    `INSERT IGNORE INTO schema_migrations (name) VALUES (:name)`,
    { name: migrationName },
  )
  console.log(`Migration applied: ${migrationName}`)
}

async function ensureLeagueCompetitionCode(connection) {
  const migrationName = '007_league_competition_code'
  const [applied] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM schema_migrations WHERE name = :name`,
    { name: migrationName },
  )
  if (Number(applied[0].cnt) > 0) {
    return
  }

  const [col] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'leagues'
       AND COLUMN_NAME = 'competition_code'`,
  )
  if (Number(col[0].cnt) === 0) {
    await connection.query(
      `ALTER TABLE leagues
       ADD COLUMN competition_code VARCHAR(16) NOT NULL DEFAULT 'WC'
         AFTER invite_code,
       ADD KEY idx_leagues_competition (competition_code)`,
    )
  }

  await connection.query(
    `UPDATE leagues SET competition_code = 'WC'
     WHERE competition_code IS NULL OR competition_code = ''`,
  )

  await connection.query(
    `INSERT IGNORE INTO schema_migrations (name) VALUES (:name)`,
    { name: migrationName },
  )
  console.log(`Migration applied: ${migrationName}`)
}

async function migrate() {
  const pool = getPool()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await ensureBaseSchema(connection)
    await ensurePasswordHashColumn(connection)
    await ensureFantasyTablesSeeded(connection)
    await ensureFixturesCacheTables(connection)
    await ensureLeagueInvites(connection)
    await ensureLeagueCompetitionCode(connection)
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
