export type TSiteHealthState = 'operational' | 'degraded' | 'unavailable'

export type TSiteHealthChain = {
  chainId: number
  name: string
  state: Exclude<TSiteHealthState, 'degraded'>
  latencyMs: number
}

export type TSiteHealth = {
  checkedAt: string
  services: {
    kong: {
      state: Exclude<TSiteHealthState, 'degraded'>
      latencyMs: number
    }
    rpc: {
      state: TSiteHealthState
      operational: number
      total: number
      chains: TSiteHealthChain[]
    }
  }
}
