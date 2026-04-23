/// <reference types="node" />

import { fetchArchiveAllocationHistory } from '../api/optimization/_lib/archiveHistory'
import { writeLocalArchiveAllocationHistoryArtifact } from '../api/optimization/_lib/localArchiveHistory'
import { readOptimizations } from '../api/optimization/_lib/redis'
import {
  SUPPORTED_ARCHIVE_ALLOCATION_HISTORY_TARGETS,
  supportsArchiveAllocationHistory
} from '../src/components/shared/constants/archiveAllocationHistory'

type TParsedCliArgs = {
  flags: Record<string, string>
}

type TArchiveHistoryTarget = {
  chainId: number
  vaultAddress: `0x${string}`
}

type TSavedArchiveHistorySummary = {
  chainId: number
  filePath: string
  fromTimestampUtc: string
  recordCount: number
  strategyCount: number
  vaultAddress: `0x${string}`
}

function parseCliArgs(argv: readonly string[]): TParsedCliArgs {
  return argv.reduce<TParsedCliArgs>(
    (state, token, index, allTokens) => {
      if (!token.startsWith('--')) {
        return state
      }

      const key = token.slice(2)
      const nextToken = allTokens[index + 1]
      const value = !nextToken || nextToken.startsWith('--') ? 'true' : nextToken

      return {
        flags: {
          ...state.flags,
          [key]: value
        }
      }
    },
    { flags: {} }
  )
}

function parseRequestedTargets(vaultsFlag: string | undefined): TArchiveHistoryTarget[] {
  if (!vaultsFlag) {
    return [...SUPPORTED_ARCHIVE_ALLOCATION_HISTORY_TARGETS]
  }

  const requestedVaults = vaultsFlag
    .split(',')
    .map((vaultAddress) => vaultAddress.trim())
    .filter((vaultAddress): vaultAddress is `0x${string}` => /^0x[a-fA-F0-9]{40}$/.test(vaultAddress))
    .map((vaultAddress) => vaultAddress.toLowerCase())

  return SUPPORTED_ARCHIVE_ALLOCATION_HISTORY_TARGETS.filter((target) =>
    requestedVaults.includes(target.vaultAddress.toLowerCase())
  )
}

function getOptimizationTimestamp(timestamp: string | null | undefined): number {
  if (!timestamp) {
    return Number.POSITIVE_INFINITY
  }

  return new Date(timestamp.replace(' UTC', 'Z').replace(' ', 'T')).getTime()
}

async function saveArchiveHistoryForTarget(
  target: TArchiveHistoryTarget,
  optimizations: NonNullable<Awaited<ReturnType<typeof readOptimizations>>>
): Promise<TSavedArchiveHistorySummary> {
  if (!supportsArchiveAllocationHistory(target.chainId, target.vaultAddress)) {
    throw new Error(`Archive allocation history is not supported for ${target.vaultAddress}`)
  }
  const vaultHistory = optimizations.filter(
    (optimization) => optimization.vault.toLowerCase() === target.vaultAddress.toLowerCase()
  )

  if (vaultHistory.length === 0) {
    throw new Error(`No Redis optimization history found for ${target.vaultAddress}`)
  }

  const fromTimestampUtc = vaultHistory.reduce<string | null>((oldestTimestamp, optimization) => {
    const nextTimestamp = optimization.source.timestampUtc ?? optimization.source.latestMatchedTimestampUtc
    if (!nextTimestamp) {
      return oldestTimestamp
    }

    if (!oldestTimestamp || getOptimizationTimestamp(nextTimestamp) < getOptimizationTimestamp(oldestTimestamp)) {
      return nextTimestamp
    }

    return oldestTimestamp
  }, null)

  if (!fromTimestampUtc) {
    throw new Error(`No usable snapshot timestamp found for ${target.vaultAddress}`)
  }

  const strategyAddresses = [
    ...new Set(
      vaultHistory.flatMap((optimization) =>
        optimization.strategyDebtRatios.map((strategyDebtRatio) => strategyDebtRatio.strategy.toLowerCase())
      )
    )
  ] as `0x${string}`[]

  const records = await fetchArchiveAllocationHistory({
    chainId: target.chainId,
    vaultAddress: target.vaultAddress,
    strategyAddresses,
    fromTimestampUtc
  })

  const filePath = await writeLocalArchiveAllocationHistoryArtifact({
    chainId: target.chainId,
    vaultAddress: target.vaultAddress,
    generatedAt: new Date().toISOString(),
    fromTimestampUtc,
    strategyAddresses,
    records
  })

  return {
    chainId: target.chainId,
    filePath,
    fromTimestampUtc,
    recordCount: records.length,
    strategyCount: strategyAddresses.length,
    vaultAddress: target.vaultAddress
  }
}

async function main(): Promise<void> {
  const parsedArgs = parseCliArgs(process.argv.slice(2))
  const requestedTargets = parseRequestedTargets(parsedArgs.flags.vaults)
  const optimizations = await readOptimizations()

  if (requestedTargets.length === 0) {
    throw new Error('No supported vaults selected. Use --vaults with supported vault addresses.')
  }
  if (!optimizations || optimizations.length === 0) {
    throw new Error('No Redis optimization history available.')
  }

  const summaries = await Promise.all(
    requestedTargets.map((target) => saveArchiveHistoryForTarget(target, optimizations))
  )
  console.log(JSON.stringify(summaries, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
