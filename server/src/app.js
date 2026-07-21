import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { healthRouter } from './routes/health.js'
import { footballRouter } from './routes/football.js'
import { errorHandler } from './middleware/errorHandler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()

const clientOrigins = (
  process.env.CLIENT_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000'
).split(',')

app.use(
  cors({
    origin: clientOrigins,
  }),
)
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/football', footballRouter)

app.use(errorHandler)

export default app
