import { describe, expect, it } from 'vitest'

import { getTimelockStrategyController, TIMELOCK_ADDRESS } from './config'

describe('timelock strategy config', () => {
  it('resolves the mainnet timelock controller', () => {
    expect(getTimelockStrategyController(1)?.timelockAddress).toBe(TIMELOCK_ADDRESS)
  })

  it('returns undefined for unsupported chains', () => {
    expect(getTimelockStrategyController(250)).toBeUndefined()
  })

  it('labels the mainnet authorized safe as yChad', () => {
    expect(getTimelockStrategyController(1)?.executorLabel).toBe('yChad')
  })
})
