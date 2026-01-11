import { toAddress, toBigInt } from '@shared/utils'
import type { TYDaemonVaultStrategy } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { KONG_GQL_BASE } from '@pages/vaults/utils/kongRest'
import useSWR from 'swr'
import { zeroAddress } from 'viem'

type TKongDebt = {
  strategy?: string | null
  performanceFee?: string | number | null
  lastReport?: string | number | null
  totalDebt?: string | number | null
  currentDebt?: string | number | null
  totalGain?: string | number | null
  totalLoss?: string | number | null
  debtRatio?: string | number | null
  targetDebtRatio?: number | null
  maxDebtRatio?: number | null
}

type TKongStrategyDetail = {
  address?: string | null
  name?: string | null
  isActive?: boolean | null
  meta?: {
    description?: string | null
    displayName?: string | null
  } | null
  apy?: {
    net?: number | null
  } | null
  lastReportDetail?: {
    apr?: {
      net?: number | null
    } | null
  } | null
}

type TKongVaultResponse = {
  vault?: {
    strategies?: string[] | null
    debts?: TKongDebt[] | null
  } | null
} & Record<string, TKongStrategyDetail | undefined>

type UseVaultStrategiesKongProps = {
  chainId?: number
  address?: string
}

const vaultQuery = `
  query VaultStrategies($chainId: Int!, $address: String!) {
    vault(chainId: $chainId, address: $address) {
      strategies
      debts {
        strategy
        performanceFee
        lastReport
        totalDebt
        currentDebt
        totalGain
        totalLoss
        debtRatio
        targetDebtRatio
        maxDebtRatio
      }
    }
  }
`

const toNumber = (value: string | number | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined) return fallback
  const normalized = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
}

const toStringValue = (value: string | number | null | undefined, fallback = '0'): string => {
  if (value === null || value === undefined) return fallback
  return String(value)
}

const pickNonZeroNumber = (...values: Array<string | number | null | undefined>): number => {
  let fallback: number | undefined
  for (const value of values) {
    if (value === null || value === undefined) continue
    const normalized = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(normalized)) continue
    if (fallback === undefined) {
      fallback = normalized
    }
    if (normalized > 0) {
      return normalized
    }
  }
  return fallback ?? 0
}

const hasNonZero = (value: string | number | null | undefined): boolean => {
  if (value === null || value === undefined) return false
  try {
    return toBigInt(value) > 0n
  } catch {
    return false
  }
}

const pickNonZeroBigNumberish = (...values: Array<string | number | null | undefined>): string => {
  let fallback: string | undefined
  for (const value of values) {
    if (value === null || value === undefined) continue
    const asString = String(value)
    if (!fallback) {
      fallback = asString
    }
    if (hasNonZero(value)) {
      return asString
    }
  }
  return fallback ?? '0'
}

const buildStrategyQuery = (addresses: string[]): string => {
  const fields = addresses
    .map(
      (address, index) => `
        strat${index}: strategy(chainId: $chainId, address: "${address}") {
          address
          name
          isActive
          meta {
            description
            displayName
          }
          apy {
            net
          }
          lastReportDetail {
            apr {
              net
            }
          }
        }
      `
    )
    .join('\n')

  return `
    query Strategies($chainId: Int!) {
      ${fields}
    }
  `
}

const fetchGql = async <T>(query: string, variables: Record<string, unknown>): Promise<T> => {
  const response = await fetch(KONG_GQL_BASE, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Kong GraphQL: ${response.status}`)
  }

  const json = (await response.json()) as { data?: T; errors?: { message?: string }[] }

  if (json.errors?.length) {
    const message = json.errors
      .map((error) => error.message)
      .filter(Boolean)
      .join('; ')
    throw new Error(message || 'Kong GraphQL error')
  }

  if (!json.data) {
    throw new Error('Kong GraphQL returned no data')
  }

  return json.data
}

const mapStrategies = (
  addresses: string[],
  debts: TKongDebt[],
  detailsMap: Map<string, TKongStrategyDetail>
): TYDaemonVaultStrategy[] => {
  const debtMap = new Map(debts.map((debt) => [toAddress(debt.strategy ?? ''), debt]))
  return addresses.map((address, index) => {
    const resolvedAddress = toAddress(address)
    const debt = debtMap.get(resolvedAddress)
    const detail = detailsMap.get(resolvedAddress)
    const description = detail?.meta?.description ?? ''
    const name = detail?.meta?.displayName || detail?.name || `Strategy ${index + 1}`
    const netAPR = toNumber(detail?.apy?.net ?? detail?.lastReportDetail?.apr?.net, 0)
    const debtRatio = pickNonZeroNumber(debt?.debtRatio, debt?.targetDebtRatio, debt?.maxDebtRatio, 0)
    const totalDebt = pickNonZeroBigNumberish(debt?.totalDebt, debt?.currentDebt)
    const totalLoss = toStringValue(debt?.totalLoss)
    const totalGain = toStringValue(debt?.totalGain)
    const performanceFee = toNumber(debt?.performanceFee)
    const lastReport = toNumber(debt?.lastReport)
    const hasAllocation = debtRatio > 0 || hasNonZero(totalDebt)
    const isActive = detail?.isActive ?? hasAllocation

    return {
      address: resolvedAddress,
      name,
      description,
      netAPR,
      status: isActive ? 'active' : 'not_active',
      details: {
        totalDebt,
        totalLoss,
        totalGain,
        performanceFee,
        lastReport,
        debtRatio
      }
    }
  })
}

export function useVaultStrategiesKong({ chainId, address }: UseVaultStrategiesKongProps) {
  const normalizedAddress = address ? toAddress(address) : undefined
  const shouldFetch = normalizedAddress && Number.isInteger(chainId)

  const { data: vaultData, isLoading: isLoadingVault } = useSWR<TKongVaultResponse>(
    shouldFetch ? ['kong-vault-strategies', chainId, normalizedAddress] : null,
    ([, chainIdValue, addressValue]) =>
      fetchGql<TKongVaultResponse>(vaultQuery, {
        chainId: Number(chainIdValue),
        address: String(addressValue)
      }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000,
      keepPreviousData: true
    }
  )

  const strategyAddresses = (vaultData?.vault?.strategies || [])
    .map((strategy) => (strategy ? toAddress(strategy) : ''))
    .filter((strategy) => strategy && strategy !== zeroAddress)

  const debts = vaultData?.vault?.debts || []
  const resolvedAddresses =
    strategyAddresses.length > 0
      ? strategyAddresses
      : debts
          .map((debt) => (debt.strategy ? toAddress(debt.strategy) : ''))
          .filter((strategy) => strategy && strategy !== zeroAddress)
  const chainIdKey = typeof chainId === 'number' ? chainId : 0

  const { data: strategyData, isLoading: isLoadingStrategies } = useSWR<
    Record<string, TKongStrategyDetail>,
    Error,
    [string, number, ...string[]] | null
  >(
    shouldFetch && resolvedAddresses.length > 0 ? ['kong-strategy-details', chainIdKey, ...resolvedAddresses] : null,
    ([, chainIdValue, ...addresses]) =>
      fetchGql<Record<string, TKongStrategyDetail>>(buildStrategyQuery(addresses), {
        chainId: Number(chainIdValue)
      }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000,
      keepPreviousData: true
    }
  )

  const strategyDetailsMap = new Map<string, TKongStrategyDetail>()
  if (strategyData) {
    Object.values(strategyData).forEach((strategy) => {
      if (!strategy?.address) return
      strategyDetailsMap.set(toAddress(strategy.address), strategy)
    })
  }

  const strategies =
    resolvedAddresses.length > 0 ? mapStrategies(resolvedAddresses, debts, strategyDetailsMap) : undefined

  return {
    strategies,
    isLoading: isLoadingVault || isLoadingStrategies
  }
}
