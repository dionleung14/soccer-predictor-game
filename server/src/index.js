import app from './app.js'
import { resolveMysqlConfig } from './db/pool.js'

const PORT = Number(process.env.PORT) || 4000

if (!resolveMysqlConfig()) {
  console.warn(
    'Warning: MySQL is not configured. /api/health and /api/predictions will fail until DATABASE_URL (or JAWSDB_URL) is set.',
  )
}

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
