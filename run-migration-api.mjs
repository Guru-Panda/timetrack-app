import { readFileSync } from 'fs'

const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdWtzZ250YWt4cmJvdGZlZ2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIzMDIyNSwiZXhwIjoyMDkzODA2MjI1fQ.eLi-XhdoR5ZtzEoYLcZj4ht6hh3Uas2las5yv233yQs'
const PROJECT_URL = 'https://uquksgntakxrbotfegct.supabase.co'

// Split migration into individual statements
const sql = readFileSync('./supabase-migration.sql', 'utf8')

// Remove comments and split on semicolons
const statements = sql
  .split('\n')
  .filter(l => !l.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0)

console.log(`Running ${statements.length} SQL statements via pg-meta API...`)

let success = 0
let failed = 0

for (const stmt of statements) {
  try {
    const res = await fetch(`${PROJECT_URL}/pg-meta/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        'x-connection-encrypted': 'true',
      },
      body: JSON.stringify({ query: stmt + ';' }),
    })
    const data = await res.json()
    if (!res.ok && data.error) {
      // Ignore "already exists" errors
      if (data.error.includes('already exists') || data.error.includes('duplicate')) {
        success++
      } else {
        console.log(`⚠ ${stmt.slice(0, 60).replace(/\n/g, ' ')}...\n  → ${data.error}`)
        failed++
      }
    } else {
      success++
    }
  } catch (e) {
    console.error('Fetch error:', e.message)
    failed++
  }
}

console.log(`\n✓ ${success} succeeded, ${failed} failed`)
