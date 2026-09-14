import pg from 'pg'
const { Client } = pg

const regions = [
  'aws-0-eu-west-2',
  'aws-0-eu-west-1',
  'aws-0-eu-central-1',
  'aws-0-us-east-1',
  'aws-0-us-west-1',
  'aws-0-ap-southeast-1',
  'aws-0-ap-south-1',
]

for (const region of regions) {
  const client = new Client({
    host: `${region}.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    user: 'postgres.uquksgntakxrbotfegct',
    password: 'a4hVsuXx@23',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  })
  try {
    await client.connect()
    console.log(`✓ Connected via ${region}`)
    await client.end()
    break
  } catch (e) {
    console.log(`✗ ${region}: ${e.message.slice(0, 50)}`)
  }
}
