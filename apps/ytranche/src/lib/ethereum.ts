import { type Address, createPublicClient, fallback, type Hex, http } from 'viem'
import { mainnet } from 'viem/chains'
import { ETHEREUM_RPC_URLS } from '@/lib/rpc'

const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback(ETHEREUM_RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 0 })))
})

export const CONTRACTS = {
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  vault: '0xDa87123895a043Ed3610155550177C54ce8ba49B',
  controller: '0xF0145433E5289dd10712650dCd28333FA317eF36',
  hook: '0x776DEd3273440f1481d07B6CE916b5d5Fac170dC',
  fixed: '0x2D4F47208853a3D20EADCbdA0F03900771C6Eba3',
  levered: '0xF7B5D8b432E8c57B4a388c2D833A473091FbF284',
  equity: '0xF0A070c0c5b808AbB8EeF6838f178D44A6d9376E'
} as const

const SELECTORS = {
  totalAssets: '0x01e1d114',
  totalSupply: '0x18160ddd',
  maxDeposit: '0x402d267d',
  trancheCoverage: '0x1c0151b1',
  tranches: '0x3bb0170d'
} as const

export const DISPLAY_RECEIVER = '0x000000000000000000000000000000000000dEaD'
const WAD = 10n ** 18n
const SECONDS_PER_YEAR = 31_556_952n

export const TOKEN_DECIMALS = 6
export const WITHDRAW_MAX_LOSS_BPS = 0n

export interface TProtocolData {
  trancheAssets: bigint
  trancheSupply: bigint
  leveredAssets: bigint
  equityAssets: bigint
  maxDeposit: bigint
  coverageClaim: bigint
  coverageCovered: bigint
  targetRateBps: bigint
  excessShareBps: bigint
  accrualPaused: boolean
  blockNumber: bigint
}

function stripHex(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value
}

export function encodeAddress(address: string): string {
  return stripHex(address).toLowerCase().padStart(64, '0')
}

function decodeWord(data: string, index = 0): bigint {
  const clean = stripHex(data)
  const word = clean.slice(index * 64, (index + 1) * 64)
  return word ? BigInt(`0x${word}`) : 0n
}

async function ethCall(to: string, data: string, blockTag: string): Promise<string> {
  const result = await publicClient.call({ to: to as Address, data: data as Hex, blockNumber: BigInt(blockTag) })
  if (!result.data || result.data === '0x') throw new Error('Ethereum call returned no data')
  return result.data
}

export async function readProtocolData(receiver?: string | null): Promise<TProtocolData> {
  const targetReceiver = receiver ?? DISPLAY_RECEIVER
  const blockNumber = await publicClient.getBlockNumber()
  const blockHex = `0x${blockNumber.toString(16)}`
  const [assetsHex, supplyHex, leveredAssetsHex, equityAssetsHex, maxHex, coverageHex, trancheConfigHex] =
    await Promise.all([
      ethCall(CONTRACTS.fixed, SELECTORS.totalAssets, blockHex),
      ethCall(CONTRACTS.fixed, SELECTORS.totalSupply, blockHex),
      ethCall(CONTRACTS.levered, SELECTORS.totalAssets, blockHex),
      ethCall(CONTRACTS.equity, SELECTORS.totalAssets, blockHex),
      ethCall(CONTRACTS.fixed, `${SELECTORS.maxDeposit}${encodeAddress(targetReceiver)}`, blockHex),
      ethCall(CONTRACTS.controller, `${SELECTORS.trancheCoverage}${encodeAddress(CONTRACTS.fixed)}`, blockHex),
      ethCall(CONTRACTS.controller, `${SELECTORS.tranches}${encodeAddress(CONTRACTS.fixed)}`, blockHex)
    ])

  const targetRatePerSecondWad = decodeWord(trancheConfigHex, 3)

  return {
    trancheAssets: decodeWord(assetsHex),
    trancheSupply: decodeWord(supplyHex),
    leveredAssets: decodeWord(leveredAssetsHex),
    equityAssets: decodeWord(equityAssetsHex),
    maxDeposit: decodeWord(maxHex),
    coverageClaim: decodeWord(coverageHex, 0),
    coverageCovered: decodeWord(coverageHex, 1),
    accrualPaused: decodeWord(trancheConfigHex, 1) === 1n,
    excessShareBps: decodeWord(trancheConfigHex, 2),
    targetRateBps: (targetRatePerSecondWad * SECONDS_PER_YEAR * 10_000n + WAD / 2n) / WAD,
    blockNumber: BigInt(blockHex)
  }
}
