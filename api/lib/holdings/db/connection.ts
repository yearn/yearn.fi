import { Pool } from '@neondatabase/serverless'
import { createHash } from 'node:crypto'
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
let schemaInitializationPromise: Promise<void> | null = null

function normalizeUserAddress(userAddress: string): string {
  return userAddress.toLowerCase()
}

function toUserAddressHash(userAddress: string): string {
  return createHash('sha256').update(normalizeUserAddress(userAddress)).digest('hex')
}

async function createPool(): Promise<DatabasePool | null> {
  if (!config.databaseUrl) {
    return null
  }

  try {
    Pool.poolQueryViaFetch = true
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
      user_address_hash VARCHAR(64) NOT NULL,
      version VARCHAR(8) NOT NULL DEFAULT 'all',
      date DATE NOT NULL,
      usd_value NUMERIC NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_address_hash, version, date)
    );

    ALTER TABLE holdings_totals ADD COLUMN IF NOT EXISTS user_address_hash VARCHAR(64);
    ALTER TABLE holdings_totals ADD COLUMN IF NOT EXISTS version VARCHAR(8);
    UPDATE holdings_totals SET version = 'all' WHERE version IS NULL;
    ALTER TABLE holdings_totals ALTER COLUMN version SET DEFAULT 'all';
    ALTER TABLE holdings_totals ALTER COLUMN version SET NOT NULL;

    CREATE TABLE IF NOT EXISTS token_prices (
      token_key VARCHAR(100) NOT NULL,
      timestamp INTEGER NOT NULL,
      price NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (token_key, timestamp)
    );

    CREATE TABLE IF NOT EXISTS token_price_misses (
      token_key VARCHAR(100) NOT NULL,
      timestamp INTEGER NOT NULL,
      expires_at TIMESTAMP NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_token_price_misses_token_key ON token_price_misses(token_key);
    CREATE INDEX IF NOT EXISTS idx_token_price_misses_expires_at ON token_price_misses(expires_at);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
    CREATE INDEX IF NOT EXISTS idx_vault_invalidations_time ON vault_invalidations(invalidated_at);
  `

  try {
    await db.query(schema)
    await migrateHoldingsTotalsAddressStorage(db)
    console.log('[Holdings DB] Schema initialized successfully')
  } catch (error) {
    console.error('[Holdings DB] Failed to initialize schema:', error)
    throw error
  }
}

export function ensureSchemaInitialized(): Promise<void> {
  if (!isDatabaseEnabled()) {
    return Promise.resolve()
  }

  if (!schemaInitializationPromise) {
    schemaInitializationPromise = initializeSchema().catch((error) => {
      schemaInitializationPromise = null
      throw error
    })
  }

  return schemaInitializationPromise
}

async function migrateHoldingsTotalsAddressStorage(db: DatabasePool): Promise<void> {
  const columnsResult = await db.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'holdings_totals'`
  )
  const columns = new Set(columnsResult.rows.map((row) => row.column_name))
  const hasLegacyUserAddressColumn = columns.has('user_address')
  const hasUserAddressHashColumn = columns.has('user_address_hash')

  if (!hasUserAddressHashColumn) {
    return
  }

  if (hasLegacyUserAddressColumn) {
    const legacyAddressesResult = await db.query<{ user_address: string }>(
      `SELECT DISTINCT user_address
       FROM holdings_totals
       WHERE user_address IS NOT NULL
         AND (user_address_hash IS NULL OR user_address_hash = '')`
    )

    for (const row of legacyAddressesResult.rows) {
      const normalizedAddress = normalizeUserAddress(row.user_address)
      const userAddressHash = toUserAddressHash(normalizedAddress)
      await db.query(
        `UPDATE holdings_totals
         SET user_address_hash = $1
         WHERE user_address = $2
           AND (user_address_hash IS NULL OR user_address_hash = '')`,
        [userAddressHash, normalizedAddress]
      )
    }
  }

  const unresolvedHashesResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM holdings_totals
     WHERE user_address_hash IS NULL OR user_address_hash = ''`
  )
  const unresolvedHashes = Number(unresolvedHashesResult.rows[0]?.count ?? '0')

  if (unresolvedHashes > 0) {
    throw new Error(`Unable to migrate holdings_totals user address hashes for ${unresolvedHashes} rows`)
  }

  const primaryKeyResult = await db.query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.table_name = 'holdings_totals'
       AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.ordinal_position`
  )
  const primaryKeyColumns = primaryKeyResult.rows.map((row) => row.column_name)
  const expectedPrimaryKeyColumns = ['user_address_hash', 'version', 'date']
  const hasExpectedPrimaryKey =
    primaryKeyColumns.length === expectedPrimaryKeyColumns.length &&
    primaryKeyColumns.every((columnName, index) => columnName === expectedPrimaryKeyColumns[index])

  if (!hasExpectedPrimaryKey) {
    await db.query('ALTER TABLE holdings_totals DROP CONSTRAINT IF EXISTS holdings_totals_pkey')
    await db.query(
      'ALTER TABLE holdings_totals ADD CONSTRAINT holdings_totals_pkey PRIMARY KEY (user_address_hash, version, date)'
    )
  }

  await db.query('ALTER TABLE holdings_totals ALTER COLUMN user_address_hash SET NOT NULL')

  if (hasLegacyUserAddressColumn) {
    await db.query('ALTER TABLE holdings_totals DROP COLUMN IF EXISTS user_address')
  }
}

export function isDatabaseEnabled(): boolean {
  return config.databaseUrl !== null
}
