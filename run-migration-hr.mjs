// Apply HR migration via the Postgres wire protocol using pg client + explicit TLS SNI.
import pg from 'pg'
import { readFileSync } from 'fs'
import 'dotenv/config'

const { Client } = pg

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL missing'); process.exit(1) }
const u = new URL(url)

const client = new Client({
  host: u.hostname,
  port: Number(u.port || 6543),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  ssl: {
    servername: u.hostname,
    rejectUnauthorized: false,
  },
  application_name: 'timetrack-migration',
})

const raw = readFileSync('./supabase-migration-hr.sql', 'utf8')
function splitSql(text) {
  const parts = []
  let buf = '', inDollar = false
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('--')) continue
    const dollars = (line.match(/\$\$/g) || []).length
    for (let i = 0; i < dollars; i++) inDollar = !inDollar
    buf += line + '\n'
    if (!inDollar && line.trim().endsWith(';')) { parts.push(buf.trim()); buf = '' }
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

const statements = splitSql(raw)
try {
  await client.connect()
  console.log('Connected ✓')
  let ok = 0, skip = 0, fail = 0
  for (const s of statements) {
    try { await client.query(s); ok++ }
    catch (e) {
      const m = String(e.message || '')
      if (/already exists|duplicate/i.test(m)) { skip++; continue }
      console.log(`⚠ ${s.slice(0, 80).replace(/\n/g, ' ')}\n  → ${m}`); fail++
    }
  }
  console.log(`\n✓ ${ok} ok · ${skip} skipped · ${fail} failed`)
  process.exit(fail ? 1 : 0)
} catch (e) {
  console.error('Connect failed:', e.message)
  process.exit(1)
} finally { try { await client.end() } catch {} }
