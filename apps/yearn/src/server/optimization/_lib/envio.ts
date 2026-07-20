const KEEPER_ADDRESS = '0x283132390eA87D6ecc20255B59Ba94329eE17961'

const DEBT_UPDATES_QUERY = `
query DebtUpdatesForVault(
  $vaultAddress: String!,
  $chainId: Int!,
  $fromTs: Int!,
  $toTs: Int!,
  $senderAddress: String!,
  $limit: Int!,
  $offset: Int!
) {
  debtUpdates: DebtUpdated(
    where: {
      vaultAddress: { _ilike: $vaultAddress },
      chainId: { _eq: $chainId },
      blockTimestamp: { _gte: $fromTs, _lte: $toTs },
      transactionFrom: { _ilike: $senderAddress }
    }
    order_by: { blockTimestamp: asc, blockNumber: asc, logIndex: asc }
    limit: $limit
    offset: $offset
  ) {
    strategy
    current_debt
    new_debt
    blockNumber
    blockTimestamp
    transactionHash
    logIndex
  }
}
`

export interface DebtUpdatedEvent {
  transactionHash: string
  strategy: string
  blockTimestamp: number
  blockTimestampUtc: string
  blockNumber: number | null
  deltaToken: number
}

interface RawDebtEvent {
  transactionHash?: string | null
  strategy?: string | null
  current_debt?: string | number | null
  new_debt?: string | number | null
  blockTimestamp?: string | number | null
  blockNumber?: string | number | null
  logIndex?: string | number | null
}

interface StrategyDebtRatio {
  strategy: string
  currentRatio: number
  targetRatio: number
}

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/i

function isAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value)
}

function signOfNumber(value: number): number {
  if (value > 0) return 1
  if (value < 0) return -1
  return 0
}

function compareIntStrings(a: string, b: string): number {
  const cleanA = a.replace(/^0+/, '') || '0'
  const cleanB = b.replace(/^0+/, '') || '0'
  if (cleanA.length !== cleanB.length) return cleanA.length - cleanB.length
  return cleanA.localeCompare(cleanB)
}

function debtDeltaSign(currentDebt: string, newDebt: string): number {
  const cmp = compareIntStrings(currentDebt, newDebt)
  if (cmp < 0) return 1
  if (cmp > 0) return -1
  return 0
}

function deltaToFloat(currentDebt: string, newDebt: string, decimals: number): number {
  const divisor = 10 ** decimals
  return Number(newDebt) / divisor - Number(currentDebt) / divisor
}

async function graphqlPost(
  url: string,
  query: string,
  variables: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
  if (process.env.ENVIO_PASSWORD) {
    headers.Authorization = `Bearer ${process.env.ENVIO_PASSWORD}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    throw new Error(`Envio GraphQL request failed: HTTP ${response.status}`)
  }

  const data = await response.json()

  if ((data as { errors?: Array<{ message?: string }> }).errors) {
    const messages = ((data as { errors?: Array<{ message?: string }> }).errors ?? [])
      .map((e) => e.message ?? String(e))
      .join('; ')
    throw new Error(`GraphQL errors: ${messages}`)
  }

  return (data as { data: Record<string, unknown> }).data
}

async function fetchDebtUpdates(
  envioUrl: string,
  vault: string,
  chainId: number,
  fromTs: number,
  toTs: number,
  pageSize = 400,
  maxEvents = 3000
): Promise<RawDebtEvent[]> {
  const events: RawDebtEvent[] = []
  let offset = 0

  while (events.length < maxEvents) {
    const data = await graphqlPost(envioUrl, DEBT_UPDATES_QUERY, {
      vaultAddress: vault,
      chainId,
      fromTs,
      toTs,
      senderAddress: KEEPER_ADDRESS,
      limit: pageSize,
      offset
    })

    const page = (data as { debtUpdates?: RawDebtEvent[] }).debtUpdates
    if (!Array.isArray(page) || page.length === 0) break

    events.push(...page.filter((item) => item && typeof item === 'object'))
    if (page.length < pageSize) break

    offset += pageSize
  }

  return events.slice(0, maxEvents)
}

export async function fetchAlignedEvents(
  envioUrl: string,
  vault: string,
  chainId: number,
  strategyDebtRatios: StrategyDebtRatio[],
  fromTs: number,
  toTs: number,
  decimals = 18,
  minExpectedBps = 25
): Promise<DebtUpdatedEvent[]> {
  const expectedBps = new Map<string, number>()
  for (const ratio of strategyDebtRatios) {
    if (!ratio.strategy || !isAddress(ratio.strategy)) continue
    const deltaBps = ratio.targetRatio - ratio.currentRatio
    if (Math.abs(deltaBps) < minExpectedBps) continue
    const addr = ratio.strategy.toLowerCase()
    expectedBps.set(addr, (expectedBps.get(addr) ?? 0) + deltaBps)
  }

  const rawEvents = await fetchDebtUpdates(envioUrl, vault, chainId, fromTs, toTs)

  const matched: DebtUpdatedEvent[] = []

  for (const event of rawEvents) {
    const strategyRaw = event.strategy
    if (!strategyRaw || typeof strategyRaw !== 'string' || !isAddress(strategyRaw)) continue

    const txHash = event.transactionHash
    if (!txHash || typeof txHash !== 'string') continue

    const currentDebtStr = String(event.current_debt ?? '0')
    const newDebtStr = String(event.new_debt ?? '0')
    const blockTs = Number(event.blockTimestamp)

    if (!currentDebtStr || !newDebtStr || !Number.isFinite(blockTs)) continue

    const deltaSign = debtDeltaSign(currentDebtStr, newDebtStr)
    if (deltaSign === 0) continue

    const expected = expectedBps.get(strategyRaw.toLowerCase())
    if (expected === undefined) continue

    if (signOfNumber(expected) !== deltaSign) continue

    const blockTs_s = Math.floor(blockTs)
    const utc = new Date(blockTs_s * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

    matched.push({
      transactionHash: txHash,
      strategy: strategyRaw,
      blockTimestamp: blockTs_s,
      blockTimestampUtc: utc,
      blockNumber: event.blockNumber != null ? Number(event.blockNumber) : null,
      deltaToken: deltaToFloat(currentDebtStr, newDebtStr, decimals)
    })
  }

  return matched
}
