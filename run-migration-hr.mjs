import pg from 'pg'
import { readFileSync } from 'fs'
import 'dotenv/config'

const { Client } = pg

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL missing'); process.exit(1) }

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
})

const raw = readFileSync('./supabase-migration-hr.sql', 'utf8')

// Split on ";" respecting dollar-quoted blocks
function splitSql(text) {
  const parts = []
  let buf = ''
  let inDollar = false
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('--')) continue
    const dollars = (line.match(/\$\$/g) || []).length
    for (let i = 0; i < dollars; i++) inDollar = !inDollar
    buf += line + '\n'
    if (!inDollar && line.trim().endsWith(';')) {
      parts.push(buf.trim())
      buf = ''
    }
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

const statements = splitSql(raw)
console.log(`Running ${statements.length} statements…`)

try {
  await client.connect()
  console.log('Connected to Supabase (pooler) ✓')
  let ok = 0, skip = 0, fail = 0
  for (const stmt of statements) {
    try {
      await client.query(stmt)
      ok++
    } catch (e) {
      const msg = String(e.message || '')
      if (/already exists|duplicate/i.test(msg)) { skip++; continue }
      console.log(`⚠ ${stmt.slice(0, 80).replace(/\n/g, ' ')}\n  → ${msg}`)
      fail++
    }
  }
  console.log(`\n✓ ${ok} ok · ${skip} skipped · ${fail} failed`)
  if (fail) process.exit(1)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
