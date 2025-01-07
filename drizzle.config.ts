import type { Config } from 'drizzle-kit'
import * as dotenv from 'dotenv'

// Load .env files
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined')
}

export default {
  dialect: "postgresql",
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL
  }
} satisfies Config 