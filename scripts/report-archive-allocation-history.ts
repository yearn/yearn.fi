/// <reference types="node" />

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Interface } from 'ethers/lib/utils.js'
import { readLocalArchiveAllocationHistoryArtifact } from '../api/optimization/_lib/localArchiveHistory'
import { getArchiveRpcEndpoints, jsonRpcBatchCall } from '../api/optimization/_lib/rpc'
import { SUPPORTED_ARCHIVE_ALLOCATION_HISTORY_TARGETS } from '../src/components/shared/constants/archiveAllocationHistory'
import type { TArchiveAllocationHistoryArtifact } from '../src/components/shared/utils/schemas/archiveAllocationHistorySchema'

type TParsedCliArgs = {
  flags: Record<string, string>
}

type TTxInfo = {
  from: `0x${string}` | null
  to: `0x${string}` | null
}

type TResolvedEvent = {
  createdBy: `0x${string}` | null
  inputSelector: string
  timestampUtc: string
  to: `0x${string}` | null
  txHash: `0x${string}`
  vaultAddress: `0x${string}`
  vaultLabel: string
  strategies: Array<{
    allocationPct: number
    name: string
    strategyAddress: `0x${string}`
  }>
}

const REPORT_PATH = join(process.cwd(), 'scratch', 'archive-allocation-history', 'non-doa-allocation-report.md')
const NAME_INTERFACE = new Interface(['function name() view returns (string)'])

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

function chunk<T>(values: readonly T[], size: number): T[][] {
  return values.reduce<T[][]>((chunks, value, index) => {
    const chunkIndex = Math.floor(index / size)
    const currentChunk = chunks[chunkIndex]
    if (currentChunk) {
      currentChunk.push(value)
      return chunks
    }

    chunks.push([value])
    return chunks
  }, [])
}

function normalizeAddress(address: string | null | undefined): `0x${string}` | null {
  return address ? (address.toLowerCase() as `0x${string}`) : null
}

async function jsonRpcBatchCallWithFallbacks<T>(
  chainId: number,
  calls: Array<{ method: string; params: unknown[] }>
): Promise<T[]> {
  const endpoints = getArchiveRpcEndpoints(chainId)
  const tryNext = async (index: number): Promise<T[]> => {
    const endpoint = endpoints[index]
    if (!endpoint) {
      throw new Error(`All RPC endpoints failed for chain ${chainId}`)
    }

    try {
      return await jsonRpcBatchCall<T>(endpoint, calls)
    } catch (error) {
      if (index >= endpoints.length - 1) {
        throw error
      }
      return tryNext(index + 1)
    }
  }

  return tryNext(0)
}

async function fetchTransactionsByHash(
  chainId: number,
  txHashes: readonly `0x${string}`[]
): Promise<Map<string, TTxInfo>> {
  const txChunks = chunk(txHashes, 50)
  const txChunkResults = await Promise.all(
    txChunks.map(async (txChunk) => {
      const txs = await jsonRpcBatchCallWithFallbacks<{
        from?: string
        to?: string | null
      } | null>(
        chainId,
        txChunk.map((txHash) => ({
          method: 'eth_getTransactionByHash',
          params: [txHash]
        }))
      )

      return txChunk.map((txHash, index) => [txHash.toLowerCase(), txs[index]] as const)
    })
  )

  return txChunkResults.flat().reduce((txByHash, [txHash, tx]) => {
    txByHash.set(txHash, {
      from: normalizeAddress(tx?.from),
      to: normalizeAddress(tx?.to ?? null)
    })
    return txByHash
  }, new Map<string, TTxInfo>())
}

async function fetchStrategyNames(
  chainId: number,
  strategyAddresses: readonly `0x${string}`[]
): Promise<Map<string, string>> {
  const strategyChunks = chunk(strategyAddresses, 50)
  const chunkResults = await Promise.all(
    strategyChunks.map(async (strategyChunk) => {
      const results = await jsonRpcBatchCallWithFallbacks<
        { result?: `0x${string}`; error?: { message?: string } } | `0x${string}`
      >(
        chainId,
        strategyChunk.map((strategyAddress) => ({
          method: 'eth_call',
          params: [{ to: strategyAddress, data: NAME_INTERFACE.encodeFunctionData('name') }, 'latest']
        }))
      )

      return strategyChunk.map((strategyAddress, index) => {
        const result = results[index]
        const hexResult =
          typeof result === 'string'
            ? result
            : typeof result === 'object' && result && 'result' in result
              ? (result.result ?? null)
              : null

        if (!hexResult || hexResult === '0x') {
          return [strategyAddress.toLowerCase(), strategyAddress] as const
        }

        try {
          const [name] = NAME_INTERFACE.decodeFunctionResult('name', hexResult)
          return [strategyAddress.toLowerCase(), String(name)] as const
        } catch {
          return [strategyAddress.toLowerCase(), strategyAddress] as const
        }
      })
    })
  )

  return chunkResults.flat().reduce((strategyNames, [strategyAddress, name]) => {
    strategyNames.set(strategyAddress, name)
    return strategyNames
  }, new Map<string, string>())
}

function formatAddress(value: string | null | undefined): string {
  return value ?? 'unknown'
}

function formatAllocations(
  strategies: readonly {
    allocationPct: number
    name: string
  }[]
): string {
  return strategies.map((strategy) => `${strategy.name} ${strategy.allocationPct.toFixed(2)}%`).join(', ')
}

function buildVaultLabel(vaultAddress: `0x${string}`): string {
  return vaultAddress.toLowerCase() === '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
    ? 'yvUSDC-1'
    : vaultAddress.toLowerCase() === '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0'
      ? 'yvWETH-1'
      : vaultAddress
}

function buildResolvedEvents(
  artifact: TArchiveAllocationHistoryArtifact,
  txByHash: Map<string, TTxInfo>,
  strategyNamesByAddress: Map<string, string>
): TResolvedEvent[] {
  return artifact.records.map((record) => ({
    createdBy: txByHash.get(record.txHash.toLowerCase())?.from ?? null,
    inputSelector: record.inputSelector,
    timestampUtc: record.timestampUtc,
    to: txByHash.get(record.txHash.toLowerCase())?.to ?? null,
    txHash: record.txHash as `0x${string}`,
    vaultAddress: artifact.vaultAddress,
    vaultLabel: buildVaultLabel(artifact.vaultAddress),
    strategies: record.strategies
      .map((strategy) => ({
        allocationPct: strategy.allocationPct,
        name: strategyNamesByAddress.get(strategy.strategyAddress.toLowerCase()) ?? strategy.strategyAddress,
        strategyAddress: strategy.strategyAddress
      }))
      .sort((left, right) => right.allocationPct - left.allocationPct)
  }))
}

function buildSummaryLines(events: readonly TResolvedEvent[]): string[] {
  const senderCounts = events.reduce<Map<string, number>>((counts, event) => {
    const sender = event.createdBy ?? 'unknown'
    counts.set(sender, (counts.get(sender) ?? 0) + 1)
    return counts
  }, new Map())

  return [...senderCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([sender, count]) => `- \`${formatAddress(sender)}\` -> ${count} event${count === 1 ? '' : 's'}`)
}

function buildEventLines(events: readonly TResolvedEvent[]): string[] {
  return events.map((event) => {
    return `- ${event.timestampUtc} | created by \`${formatAddress(event.createdBy)}\` | to \`${formatAddress(event.to)}\` | selector \`${event.inputSelector}\` | tx \`${event.txHash}\` | resulting allocation: ${formatAllocations(event.strategies)}`
  })
}

async function main(): Promise<void> {
  const parsedArgs = parseCliArgs(process.argv.slice(2))
  const requestedVaults = (parsedArgs.flags.vaults ?? '')
    .split(',')
    .map((vaultAddress) => vaultAddress.trim().toLowerCase())
    .filter(Boolean)

  const artifacts = (
    await Promise.all(
      SUPPORTED_ARCHIVE_ALLOCATION_HISTORY_TARGETS.filter((target) =>
        requestedVaults.length === 0 ? true : requestedVaults.includes(target.vaultAddress.toLowerCase())
      ).map(async (target) => ({
        label: buildVaultLabel(target.vaultAddress),
        artifact: await readLocalArchiveAllocationHistoryArtifact({
          chainId: target.chainId,
          vaultAddress: target.vaultAddress
        })
      }))
    )
  )
    .flatMap(({ label, artifact }) => (artifact ? [{ label, artifact }] : []))
    .sort((left, right) => left.label.localeCompare(right.label))

  if (artifacts.length === 0) {
    throw new Error('No local archive allocation history artifacts found. Run bun run archive-history:save first.')
  }

  const chainId = artifacts[0]?.artifact.chainId ?? 1
  const txHashes = [
    ...new Set(artifacts.flatMap(({ artifact }) => artifact.records.map((record) => record.txHash as `0x${string}`)))
  ]
  const strategyAddresses = [
    ...new Set(
      artifacts.flatMap(({ artifact }) =>
        artifact.records.flatMap((record) => record.strategies.map((strategy) => strategy.strategyAddress))
      )
    )
  ]

  const [txByHash, strategyNamesByAddress] = await Promise.all([
    fetchTransactionsByHash(chainId, txHashes),
    fetchStrategyNames(chainId, strategyAddresses)
  ])

  const vaultSections = artifacts.map(({ label, artifact }) => {
    const events = buildResolvedEvents(artifact, txByHash, strategyNamesByAddress)
    const uniqueSenders = new Set(events.map((event) => event.createdBy ?? 'unknown')).size

    return [
      `## ${label}`,
      '',
      `- From artifact: \`${artifact.vaultAddress}\``,
      `- From snapshot window start: ${artifact.fromTimestampUtc}`,
      `- Saved artifact generated at: ${artifact.generatedAt}`,
      `- Candidate non-DOA allocation events: ${events.length}`,
      `- Unique outer transaction senders: ${uniqueSenders}`,
      '',
      '### Top Senders',
      '',
      ...buildSummaryLines(events),
      '',
      '### Event Timeline',
      '',
      ...buildEventLines(events),
      ''
    ].join('\n')
  })

  const report = [
    '# Potential Non-DOA Allocation Report',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- Source artifacts: saved local archive snapshots in `scratch/archive-allocation-history/`',
    '- Vaults covered: `yvUSDC-1` and `yvWETH-1`',
    '- "Non-DOA" here means the current heuristic already excluded `deposit`, `mint`, `withdraw`, `redeem`, and the known DOA executor selector `0x22bee494`.',
    '- "Created by" is the outer transaction sender from `eth_getTransactionByHash`. That is useful, but it is not the same thing as full internal-call attribution for multisigs/modules.',
    '',
    ...vaultSections
  ].join('\n')

  await mkdir(dirname(REPORT_PATH), { recursive: true })
  await writeFile(REPORT_PATH, `${report}\n`, 'utf8')
  console.log(REPORT_PATH)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
