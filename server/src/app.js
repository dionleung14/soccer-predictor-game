import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { healthRouter } from './routes/health.js'
import { footballRouter } from './routes/football.js'
import { predictionsRouter } from './routes/predictions.js'
import { errorHandler } from './middleware/errorHandler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const isProd = process.env.NODE_ENV === 'production'

const clientOrigins = (
  process.env.CLIENT_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: isProd ? true : clientOrigins,
  }),
)
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/football', footballRouter)
app.use('/api/predictions', predictionsRouter)

// Heroku monorepo: serve the Vite build from the same dyno as the API.
const clientDist = path.resolve(__dirname, '../../client/dist')
if (isProd) {
  app.use(express.static(clientDist))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.use(errorHandler)

export default app
