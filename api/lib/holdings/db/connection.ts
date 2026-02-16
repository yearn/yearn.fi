import { config } from '../config'

interface QueryResult<T> {
  rows: T[]
  rowCount: number
}

interface DatabasePool {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<QueryResult<T>>
  end: () => Promise<void>
}

let pool: DatabasePool | null = null

async function createPool(): Promise<DatabasePool | null> {
  if (!config.databaseUrl) {
    return null
  }

  try {
    const { Pool } = await import('pg')
    const pgPool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('neon') ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })

    return {
      query: async <T>(text: string, params?: unknown[]) => {
        const result = await pgPool.query(text, params)
        return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 }
      },
      end: () => pgPool.end()
    }
  } catch (error) {
    console.error('[Holdings DB] Failed to create pool:', error)
    return null
  }
}

export async function getPool(): Promise<DatabasePool | null> {
  if (pool === null && config.databaseUrl) {
    pool = await createPool()
  }
  return pool
}

export async function initializeSchema(): Promise<void> {
  const db = await getPool()
  if (!db) {
    console.log('[Holdings DB] No database configured, skipping schema initialization')
    return
  }

  const schema = `
    CREATE TABLE IF NOT EXISTS holdings_cache (
      id SERIAL PRIMARY KEY,
      user_address VARCHAR(42) NOT NULL,
      date DATE NOT NULL,
      chain_id INT NOT NULL,
      vault_address VARCHAR(42) NOT NULL,
      shares NUMERIC NOT NULL,
      usd_value NUMERIC NOT NULL,
      price_per_share NUMERIC NOT NULL DEFAULT 1.0,
      underlying_price NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_address, date, chain_id, vault_address)
    );

    CREATE INDEX IF NOT EXISTS idx_holdings_user_date
      ON holdings_cache(user_address, date);
  `

  try {
    await db.query(schema)
    console.log('[Holdings DB] Schema initialized successfully')
  } catch (error) {
    console.error('[Holdings DB] Failed to initialize schema:', error)
  }
}

export function isDatabaseEnabled(): boolean {
  return config.databaseUrl !== null
}
