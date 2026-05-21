import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHoldingsRedisClientMock = vi.fn()
const isHoldingsStorageEnabledMock = vi.fn()
const handleHoldingsRedisErrorMock = vi.fn()

vi.mock('../storage/redis', () => ({
  getHoldingsRedisClient: getHoldingsRedisClientMock,
  isHoldingsStorageEnabled: isHoldingsStorageEnabledMock,
  handleHoldingsRedisError: handleHoldingsRedisErrorMock
}))

describe('Redis holdings progress', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isHoldingsStorageEnabledMock.mockReturnValue(true)
  })

  it('persists and reads progress records with a ttl', async () => {
    const redisState = { value: null as string | null }
    const getMock = vi.fn().mockImplementation(() => Promise.resolve(redisState.value))
    const setMock = vi.fn().mockImplementation((_key: string, value: string) => {
      redisState.value = value
      return Promise.resolve('OK')
    })
    getHoldingsRedisClientMock.mockReturnValue({
      get: getMock,
      set: setMock
    })

    const { getHoldingsProgress, startHoldingsProgress, updateHoldingsProgress } = await import('./progress')
    const id = await startHoldingsProgress({
      id: 'portfolio:test',
      route: 'history',
      address: '0x0000000000000000000000000000000000000001',
      message: 'Fetching historical user data'
    })
    await updateHoldingsProgress(id, {
      progress: 40,
      message: 'Fetched prices'
    })

    const record = await getHoldingsProgress({
      id,
      route: 'history',
      address: '0x0000000000000000000000000000000000000001'
    })

    expect(id).toBe('portfolio:test')
    expect(record?.progress).toBe(40)
    expect(record?.message).toBe('Fetched prices')
    expect(setMock.mock.calls[0]?.[0]).toBe('holdings:progress:portfolio:test')
    expect(setMock.mock.calls[0]?.[2]).toEqual({ ex: 10 * 60 })
  })

  it('requires id, route, and address to read progress records', async () => {
    const redisState = { value: null as string | null }
    const getMock = vi.fn().mockImplementation(() => Promise.resolve(redisState.value))
    const setMock = vi.fn().mockImplementation((_key: string, value: string) => {
      redisState.value = value
      return Promise.resolve('OK')
    })
    getHoldingsRedisClientMock.mockReturnValue({
      get: getMock,
      set: setMock
    })

    const { getHoldingsProgress, startHoldingsProgress } = await import('./progress')
    const id = await startHoldingsProgress({
      id: 'portfolio:scoped',
      route: 'history',
      address: '0x0000000000000000000000000000000000000001',
      message: 'Fetching historical user data'
    })

    await expect(
      getHoldingsProgress({
        id,
        route: 'history',
        address: '0x0000000000000000000000000000000000000002'
      })
    ).resolves.toBeNull()
    await expect(
      getHoldingsProgress({
        id,
        route: 'pnl-simple-history',
        address: '0x0000000000000000000000000000000000000001'
      })
    ).resolves.toBeNull()
    await expect(
      getHoldingsProgress({
        id,
        route: 'history',
        address: '0x0000000000000000000000000000000000000001'
      })
    ).resolves.toMatchObject({ id, route: 'history' })
  })

  it('does not overwrite an existing live progress record for another route or address', async () => {
    const redisState = { value: null as string | null }
    const getMock = vi.fn().mockImplementation(() => Promise.resolve(redisState.value))
    const setMock = vi.fn().mockImplementation((_key: string, value: string) => {
      redisState.value = value
      return Promise.resolve('OK')
    })
    getHoldingsRedisClientMock.mockReturnValue({
      get: getMock,
      set: setMock
    })

    const { getHoldingsProgress, startHoldingsProgress } = await import('./progress')
    const id = await startHoldingsProgress({
      id: 'portfolio:collision',
      route: 'history',
      address: '0x0000000000000000000000000000000000000001',
      message: 'Fetching historical user data'
    })
    const collidingAddressId = await startHoldingsProgress({
      id,
      route: 'history',
      address: '0x0000000000000000000000000000000000000002',
      message: 'Fetching another user'
    })
    const collidingRouteId = await startHoldingsProgress({
      id,
      route: 'pnl-simple-history',
      address: '0x0000000000000000000000000000000000000001',
      message: 'Fetching another route'
    })

    expect(collidingAddressId).toBeNull()
    expect(collidingRouteId).toBeNull()
    await expect(
      getHoldingsProgress({
        id,
        route: 'history',
        address: '0x0000000000000000000000000000000000000001'
      })
    ).resolves.toMatchObject({ id, route: 'history', message: 'Fetching historical user data' })
    expect(setMock).toHaveBeenCalledTimes(1)
  })
})
