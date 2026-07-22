import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import dotenv from 'dotenv'
import { closePool } from '../db/pool.js'
import { CACHED_COMPETITION_CODES } from './competitionCodes.js'
import {
  syncAllCachedCompetitions,
  syncCompetitionFixtures,
} from './fixturesService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function main() {
  const codeArg = process.argv[2]?.toUpperCase()
  if (codeArg && codeArg !== 'ALL') {
    if (!CACHED_COMPETITION_CODES.includes(codeArg)) {
      throw new Error(
        `Unsupported code ${codeArg}. Use one of: ${CACHED_COMPETITION_CODES.join(', ')} or ALL`,
      )
    }
    const result = await syncCompetitionFixtures(codeArg)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const results = await syncAllCachedCompetitions()
  console.log(JSON.stringify(results, null, 2))
}

const isCli =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isCli) {
  main()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fixture sync failed:', err)
      closePool().finally(() => process.exit(1))
    })
}
