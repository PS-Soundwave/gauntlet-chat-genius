import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Load dotenv only if we're not in Next.js environment
if (process.env.NODE_ENV !== 'production' && !process.env.NEXT_RUNTIME) {
  require('dotenv').config()
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined')
}

const pool = new Pool({
  connectionString: databaseUrl
})

export const db = drizzle(pool, { schema }) 