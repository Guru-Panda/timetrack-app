import pg from 'pg'
import { readFileSync } from 'fs'

const { Client } = pg

// Direct connection (bypasses pooler)
const client = new Client({
  host: 'db.uquksgntakxrbotfegct.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'a4hVsuXx@23',
  ssl: { rejectUnauthorized: false }
})

const sql = readFileSync('./supabase-migration.sql', 'utf8')

try {
  await client.connect()
  console.log('Connected to Supabase ✓')
  await client.query(sql)
  console.log('Migration complete ✓')
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
} finally {
  await client.end()
}

