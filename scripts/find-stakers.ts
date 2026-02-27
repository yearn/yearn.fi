import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { clearLine, cursorTo, moveCursor } from 'node:readline'
import { type Address, createPublicClient, getAddress, http, parseAbi, parseAbiItem } from 'viem'

type TScriptOptions = {
  chainId: number
  contract: Address
  fromBlock: bigint
  toBlock?: bigint
  output: string
  initialChunk: bigint
  minChunk: bigint
}

type THolderLog = {
  user: Address
  amount: bigint
  blockNumber: bigint
}

type THolderState = {
  netStaked: bigint
  lastActivityBlock: bigint
}

type TVerifiedHolder = THolderState & {
  address: Address
  balanceOf: bigint
}

type TProgressPhase = {
  label: string
  current: bigint
  total: bigint
  detail: string
}

const STAKED_EVENT = parseAbiItem('event Staked(address indexed user, uint256 amount)')
const STAKED_FOR_EVENT = parseAbiItem('event StakedFor(address indexed user, uint256 amount)')
const WITHDRAWN_EVENT = parseAbiItem('event Withdrawn(address indexed user, uint256 amount)')
const BALANCE_OF_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])

const DEFAULT_CONTRACT = '0xB2c04C55979B6CA7EB10e666933DE5ED84E6876b'
const DEFAULT_FROM_BLOCK = 0x51fcc6dn
const DEFAULT_OUTPUT = '/tmp/stakers-op-boost.csv'
const DEFAULT_INITIAL_CHUNK = 10000n
const DEFAULT_MIN_CHUNK = 250n

class CompactProgressUI {
  private readonly phaseOrder: string[] = []
  private readonly phases = new Map<string, TProgressPhase>()
  private readonly recentEvents: string[] = []
  private readonly barWidth = 30
  private readonly maxRecentEvents = 6
  private readonly redrawIntervalMs = 120
  private readonly fallbackIntervalMs = 3000
  private readonly startedAt = Date.now()
  private readonly interactive = Boolean(process.stdout.isTTY)
  private frameLines = 0
  private lastRenderAt = 0
  private lastFallbackAt = 0
  private queuedRender: ReturnType<typeof setTimeout> | undefined

  addPhase(id: string, label: string, total: bigint): void {
    this.phases.set(id, { label, current: 0n, total, detail: '' })
    this.phaseOrder.push(id)
    this.render()
  }

  updatePhase(id: string, current: bigint, detail = ''): void {
    const phase = this.phases.get(id)
    if (!phase) {
      return
    }

    const boundedCurrent = phase.total <= 0n ? 0n : current > phase.total ? phase.total : current < 0n ? 0n : current
    this.phases.set(id, {
      ...phase,
      current: boundedCurrent,
      detail
    })
    this.render()
  }

  completePhase(id: string, detail = ''): void {
    const phase = this.phases.get(id)
    if (!phase) {
      return
    }
    this.phases.set(id, {
      ...phase,
      current: phase.total <= 0n ? 0n : phase.total,
      detail
    })
    this.render(true)
  }

  pushEvent(message: string): void {
    this.recentEvents.push(message)
    while (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift()
    }
    this.render()
  }

  finish(): void {
    if (this.queuedRender) {
      clearTimeout(this.queuedRender)
      this.queuedRender = undefined
    }
    this.render(true)
  }

  private render(force = false): void {
    if (!this.interactive) {
      this.renderFallback(force)
      return
    }

    const now = Date.now()
    const elapsedMs = now - this.lastRenderAt
    if (!force && elapsedMs < this.redrawIntervalMs) {
      if (!this.queuedRender) {
        this.queuedRender = setTimeout(() => {
          this.queuedRender = undefined
          this.render(true)
        }, this.redrawIntervalMs - elapsedMs)
      }
      return
    }

    this.lastRenderAt = now
    const lines = this.buildLines()
    const lineCount = Math.max(this.frameLines, lines.length)

    if (this.frameLines > 0) {
      moveCursor(process.stdout, 0, -this.frameLines)
    }

    for (let i = 0; i < lineCount; i += 1) {
      cursorTo(process.stdout, 0)
      clearLine(process.stdout, 0)
      if (i < lines.length) {
        process.stdout.write(lines[i])
      }
      process.stdout.write('\n')
    }

    this.frameLines = lines.length
  }

  private renderFallback(force = false): void {
    const now = Date.now()
    if (!force && now - this.lastFallbackAt < this.fallbackIntervalMs) {
      return
    }
    this.lastFallbackAt = now

    const summary = this.phaseOrder
      .map((id) => {
        const phase = this.phases.get(id)
        if (!phase) return undefined
        const numerator = phase.total <= 0n ? 0n : phase.current
        const percent = phase.total <= 0n ? '100.00' : toPercent(numerator, phase.total)
        return `${phase.label}:${percent}%`
      })
      .filter((item): item is string => Boolean(item))
      .join(' | ')
    if (summary) {
      console.log(`[progress] ${summary}`)
    }
    const latestEvent = this.recentEvents[this.recentEvents.length - 1]
    if (latestEvent) {
      console.log(`[event] ${latestEvent}`)
    }
  }

  private buildLines(): string[] {
    const elapsedSec = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000))
    const lines: string[] = [`Progress (${elapsedSec}s)`]

    for (const id of this.phaseOrder) {
      const phase = this.phases.get(id)
      if (!phase) {
        continue
      }
      lines.push(this.formatPhaseLine(phase))
    }

    lines.push('Recent events:')
    if (this.recentEvents.length === 0) {
      lines.push('- (none)')
      return lines
    }

    for (const event of this.recentEvents) {
      lines.push(`- ${event}`)
    }
    return lines
  }

  private formatPhaseLine(phase: TProgressPhase): string {
    const numerator = phase.total <= 0n ? 0n : phase.current
    const denominator = phase.total <= 0n ? 1n : phase.total
    const filled = phase.total <= 0n ? this.barWidth : Number((numerator * BigInt(this.barWidth)) / denominator)
    const bar = `${'#'.repeat(filled)}${'-'.repeat(this.barWidth - filled)}`
    const percent = phase.total <= 0n ? '100.00' : toPercent(numerator, phase.total)
    const totalDisplay = phase.total <= 0n ? '0' : phase.total.toString()
    const detail = phase.detail ? ` ${phase.detail}` : ''
    return `${phase.label.padEnd(10)} [${bar}] ${percent.padStart(6)}% ${numerator.toString()}/${totalDisplay}${detail}`
  }
}

function getArg(flag: string): string | undefined {
  const args = process.argv.slice(2)
  const idx = args.indexOf(`--${flag}`)
  if (idx === -1) return undefined
  return args[idx + 1]
}

function parseBlock(value: string): bigint {
  return BigInt(value)
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

function toPercent(numerator: bigint, denominator: bigint): string {
  if (denominator <= 0n) {
    return '100.00'
  }
  const basisPoints = (numerator * 10_000n) / denominator
  const whole = basisPoints / 100n
  const decimals = basisPoints % 100n
  return `${whole}.${decimals.toString().padStart(2, '0')}`
}

function parseOptions(): TScriptOptions {
  const chainId = Number(getArg('chain-id') ?? '10')
  const contractRaw = getArg('contract') ?? DEFAULT_CONTRACT
  const fromBlockRaw = getArg('from-block')
  const toBlockRaw = getArg('to-block')
  const output = getArg('output') ?? DEFAULT_OUTPUT
  const initialChunkRaw = getArg('initial-chunk')
  const minChunkRaw = getArg('min-chunk')

  return {
    chainId,
    contract: getAddress(contractRaw),
    fromBlock: fromBlockRaw ? parseBlock(fromBlockRaw) : DEFAULT_FROM_BLOCK,
    toBlock: toBlockRaw ? parseBlock(toBlockRaw) : undefined,
    output,
    initialChunk: initialChunkRaw ? parseBlock(initialChunkRaw) : DEFAULT_INITIAL_CHUNK,
    minChunk: minChunkRaw ? parseBlock(minChunkRaw) : DEFAULT_MIN_CHUNK
  }
}

function toHolderLog(log: {
  args: { user?: Address; amount?: bigint }
  blockNumber: bigint | null
}): THolderLog | undefined {
  if (!log.args.user || log.args.amount === undefined || log.blockNumber === null) {
    return undefined
  }
  return {
    user: getAddress(log.args.user),
    amount: log.args.amount,
    blockNumber: log.blockNumber
  }
}

async function fetchEventLogs(params: {
  client: ReturnType<typeof createPublicClient>
  address: Address
  event: typeof STAKED_EVENT | typeof STAKED_FOR_EVENT | typeof WITHDRAWN_EVENT
  eventName: string
  phaseId: string
  fromBlock: bigint
  toBlock: bigint
  initialChunk: bigint
  minChunk: bigint
  progress: CompactProgressUI
}): Promise<THolderLog[]> {
  const { client, address, event, eventName, phaseId, fromBlock, toBlock, initialChunk, minChunk, progress } = params
  const logs: THolderLog[] = []
  const startedAt = Date.now()
  let requests = 0n

  progress.pushEvent(`[${eventName}] scan start ${fromBlock}-${toBlock} chunk=${initialChunk}`)

  async function fetchRange(start: bigint, chunkSize: bigint): Promise<void> {
    if (start > toBlock) {
      return
    }

    const end = minBigInt(start + chunkSize - 1n, toBlock)

    try {
      requests += 1n
      const batch = await client.getLogs({
        address,
        event,
        fromBlock: start,
        toBlock: end
      })

      const normalized = batch.map(toHolderLog).filter((item): item is THolderLog => Boolean(item))
      logs.push(...normalized)

      const processedBlocks = end - fromBlock + 1n
      progress.updatePhase(
        phaseId,
        processedBlocks,
        `req=${requests.toString()} logs=${logs.length} chunk=${chunkSize}`
      )

      await fetchRange(end + 1n, chunkSize)
    } catch (error) {
      if (chunkSize <= minChunk) {
        progress.pushEvent(`[${eventName}] failed at ${start}-${end} chunk=${chunkSize}`)
        throw new Error(`[${eventName}] failed at ${start}-${end} with chunk=${chunkSize}: ${String(error)}`)
      }
      const reducedChunk = minBigInt(chunkSize / 2n, chunkSize - 1n)
      const nextChunk = reducedChunk < minChunk ? minChunk : reducedChunk
      progress.pushEvent(`[${eventName}] reduce chunk ${chunkSize}->${nextChunk} at ${start}-${end}`)
      await fetchRange(start, nextChunk)
    }
  }

  progress.updatePhase(phaseId, 0n, `req=0 logs=0 chunk=${initialChunk}`)
  await fetchRange(fromBlock, initialChunk)
  const totalElapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
  progress.completePhase(phaseId, `req=${requests.toString()} logs=${logs.length} elapsed=${totalElapsedSec}s`)
  progress.pushEvent(`[${eventName}] done req=${requests.toString()} logs=${logs.length} elapsed=${totalElapsedSec}s`)
  return logs
}

function applyDelta(map: Map<Address, THolderState>, log: THolderLog, delta: bigint): Map<Address, THolderState> {
  const current = map.get(log.user) ?? { netStaked: 0n, lastActivityBlock: 0n }
  map.set(log.user, {
    netStaked: current.netStaked + delta,
    lastActivityBlock: current.lastActivityBlock > log.blockNumber ? current.lastActivityBlock : log.blockNumber
  })
  return map
}

async function verifyHolders(params: {
  client: ReturnType<typeof createPublicClient>
  contract: Address
  candidates: Array<[Address, THolderState]>
  cursor?: number
  pageSize: number
  acc?: TVerifiedHolder[]
  phaseId: string
  progress: CompactProgressUI
}): Promise<TVerifiedHolder[]> {
  const { client, contract, candidates, pageSize, phaseId, progress } = params
  const cursor = params.cursor ?? 0
  const acc = params.acc ?? []

  if (cursor >= candidates.length) {
    progress.completePhase(phaseId, `non_zero=${acc.length}`)
    progress.pushEvent(`[verify] done candidates=${candidates.length} non_zero=${acc.length}`)
    return acc
  }

  const page = candidates.slice(cursor, cursor + pageSize)
  const verified = await Promise.all(
    page.map(async ([address, state]): Promise<TVerifiedHolder | undefined> => {
      const balanceOf = await client.readContract({
        address: contract,
        abi: BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [address]
      })

      if (balanceOf <= 0n) {
        return undefined
      }

      return {
        address,
        netStaked: state.netStaked,
        lastActivityBlock: state.lastActivityBlock,
        balanceOf
      }
    })
  )

  const next = [...acc, ...verified.filter((item): item is TVerifiedHolder => Boolean(item))]
  const processed = minBigInt(BigInt(cursor + page.length), BigInt(candidates.length))
  progress.updatePhase(phaseId, processed, `non_zero=${next.length} page=${page.length}`)
  return verifyHolders({
    client,
    contract,
    candidates,
    cursor: cursor + pageSize,
    pageSize,
    acc: next,
    phaseId,
    progress
  })
}

async function main(): Promise<void> {
  const progress = new CompactProgressUI()
  const options = parseOptions()
  const rpcEnvKey = `VITE_RPC_URI_FOR_${options.chainId}`
  const rpcUrl = process.env[rpcEnvKey]

  if (!rpcUrl) {
    throw new Error(`Missing RPC env var: ${rpcEnvKey}`)
  }

  const client = createPublicClient({
    transport: http(rpcUrl, { timeout: 30_000, retryCount: 2 })
  })

  const resolvedToBlock = options.toBlock ?? (await client.getBlockNumber())
  if (options.fromBlock > resolvedToBlock) {
    throw new Error(`fromBlock (${options.fromBlock}) is greater than toBlock (${resolvedToBlock})`)
  }

  console.log(`RPC env: ${rpcEnvKey}`)
  console.log(`Contract: ${options.contract}`)
  console.log(`Range: ${options.fromBlock} -> ${resolvedToBlock}`)
  console.log(`Output: ${resolve(options.output)}`)
  console.log(`Chunking: initial=${options.initialChunk} min=${options.minChunk}`)

  try {
    const scanTotalBlocks = resolvedToBlock - options.fromBlock + 1n
    progress.addPhase('scan:staked', 'Staked', scanTotalBlocks)
    progress.addPhase('scan:stakedFor', 'StakedFor', scanTotalBlocks)
    progress.addPhase('scan:withdrawn', 'Withdrawn', scanTotalBlocks)

    const [stakedLogs, stakedForLogs, withdrawnLogs] = await Promise.all([
      fetchEventLogs({
        client,
        address: options.contract,
        event: STAKED_EVENT,
        eventName: 'Staked',
        phaseId: 'scan:staked',
        fromBlock: options.fromBlock,
        toBlock: resolvedToBlock,
        initialChunk: options.initialChunk,
        minChunk: options.minChunk,
        progress
      }),
      fetchEventLogs({
        client,
        address: options.contract,
        event: STAKED_FOR_EVENT,
        eventName: 'StakedFor',
        phaseId: 'scan:stakedFor',
        fromBlock: options.fromBlock,
        toBlock: resolvedToBlock,
        initialChunk: options.initialChunk,
        minChunk: options.minChunk,
        progress
      }),
      fetchEventLogs({
        client,
        address: options.contract,
        event: WITHDRAWN_EVENT,
        eventName: 'Withdrawn',
        phaseId: 'scan:withdrawn',
        fromBlock: options.fromBlock,
        toBlock: resolvedToBlock,
        initialChunk: options.initialChunk,
        minChunk: options.minChunk,
        progress
      })
    ])

    progress.pushEvent(
      `Fetched logs Staked=${stakedLogs.length} StakedFor=${stakedForLogs.length} Withdrawn=${withdrawnLogs.length}`
    )
    console.log(
      `Fetched logs: Staked=${stakedLogs.length}, StakedFor=${stakedForLogs.length}, Withdrawn=${withdrawnLogs.length}`
    )

    const holdersFromStaked = stakedLogs.reduce(
      (map, log) => applyDelta(map, log, log.amount),
      new Map<Address, THolderState>()
    )
    const holdersFromStakedFor = stakedForLogs.reduce((map, log) => applyDelta(map, log, log.amount), holdersFromStaked)
    const holders = withdrawnLogs.reduce((map, log) => applyDelta(map, log, -log.amount), holdersFromStakedFor)

    const candidates = Array.from(holders.entries()).filter(([, state]) => state.netStaked > 0n)
    progress.pushEvent(`Ledger-positive candidates=${candidates.length}`)
    console.log(`Ledger-positive candidates: ${candidates.length}`)

    progress.addPhase('verify', 'balanceOf', BigInt(candidates.length))
    progress.updatePhase('verify', 0n, `non_zero=0 page=0`)

    const verified = await verifyHolders({
      client,
      contract: options.contract,
      candidates,
      pageSize: 100,
      phaseId: 'verify',
      progress
    })

    const sorted = verified.toSorted((a, b) => {
      if (a.balanceOf === b.balanceOf) return 0
      return a.balanceOf > b.balanceOf ? -1 : 1
    })

    const outputPath = resolve(options.output)
    await mkdir(dirname(outputPath), { recursive: true })

    const rows = [
      'address,net_staked,last_activity_block,balance_of,confidence',
      ...sorted.map((holder) =>
        [
          holder.address,
          holder.netStaked.toString(),
          holder.lastActivityBlock.toString(),
          holder.balanceOf.toString(),
          'high'
        ].join(',')
      )
    ]

    await writeFile(outputPath, `${rows.join('\n')}\n`, 'utf8')
    const totalBalance = sorted.reduce((sum, holder) => sum + holder.balanceOf, 0n)
    progress.pushEvent(`CSV written ${outputPath}`)
    progress.finish()

    console.log(`Verified stakers: ${sorted.length}`)
    console.log(`Total staked (raw units): ${totalBalance.toString()}`)
    console.log(`CSV written: ${outputPath}`)
  } catch (error) {
    progress.finish()
    throw error
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
