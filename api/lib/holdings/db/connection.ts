import { Pool } from '@neondatabase/serverless'
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
    const neonPool = new Pool({ connectionString: config.databaseUrl })

    return {
      query: async <T>(text: string, params?: unknown[]) => {
        const result = await neonPool.query(text, params)
        return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 }
      },
      end: () => neonPool.end()
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
    CREATE TABLE IF NOT EXISTS holdings_totals (
      user_address VARCHAR(42) NOT NULL,
      date DATE NOT NULL,
      usd_value NUMERIC NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_address, date)
    );

    CREATE TABLE IF NOT EXISTS token_prices (
      token_key VARCHAR(100) NOT NULL,
      timestamp INTEGER NOT NULL,
      price NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (token_key, timestamp)
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      ip VARCHAR(45) PRIMARY KEY,
      request_count INTEGER DEFAULT 1,
      window_start TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vault_invalidations (
      vault_address VARCHAR(42) NOT NULL,
      chain_id INTEGER NOT NULL,
      invalidated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (vault_address, chain_id)
    );

    CREATE INDEX IF NOT EXISTS idx_token_prices_token_key ON token_prices(token_key);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
    CREATE INDEX IF NOT EXISTS idx_vault_invalidations_time ON vault_invalidations(invalidated_at);
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
