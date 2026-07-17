export type TPendingTimelockStrategy = {
  chainId: number
  timelockAddress: `0x${string}`
  vaultAddress: `0x${string}`
  strategyAddress: `0x${string}`
  operationId: `0x${string}`
  status: 'queued' | 'ready'
  queuedAt: number
  eta: number
  delay: number
  scheduleTxHash: `0x${string}`
  executorLabel: string
  strategyName?: string
  strategySymbol?: string
  maxDebtRaw?: string
  decodedCalls: Array<{
    index: number
    signature: string
    target: `0x${string}`
  }>
}

export type TPendingTimelockStrategiesResponse = {
  chainId: number
  vaultAddress: `0x${string}`
  generatedAt: number
  items: TPendingTimelockStrategy[]
}
