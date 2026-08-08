import { describe, expect, it } from 'vitest'
import { LEDGER_ADMIN_CORS_HEADERS } from '@/server/http'

describe('ledger CORS headers', () => {
  it('exposes ledger identity headers to browser clients', () => {
    const exposedHeaders = LEDGER_ADMIN_CORS_HEADERS['Access-Control-Expose-Headers']
      .split(',')
      .map((header) => header.trim())

    expect(exposedHeaders).toEqual([
      'X-Holdings-Ledger-Snapshot',
      'X-Holdings-Ledger-Revision',
      'X-Holdings-Ledger-Source-Generation',
      'X-Holdings-Ledger-Calculation-Version',
      'X-Holdings-Ledger-Runtime-Fingerprint'
    ])
  })
})
