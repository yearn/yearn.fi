import { describe, expect, it } from 'vitest'
import { shouldDisableDatabaseOnQueryError } from './connection'

describe('shouldDisableDatabaseOnQueryError', () => {
  it('disables the database cache on Neon password authentication failures', () => {
    const error = Object.assign(new Error("password authentication failed for user 'neondb_owner'"), { code: '28P01' })

    expect(shouldDisableDatabaseOnQueryError(error)).toBe(true)
  })

  it('does not disable the database cache on ordinary query errors', () => {
    const error = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })

    expect(shouldDisableDatabaseOnQueryError(error)).toBe(false)
  })
})
