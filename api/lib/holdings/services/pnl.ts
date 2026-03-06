import { getUnderlyingVault } from '../constants'
import type { DepositEvent, FifoLot, PnLResponse, TransferEvent, VaultPnL, WithdrawEvent } from '../types'
import { fetchHistoricalPrices, getChainPrefix } from './defillama'
import { fetchUserEvents, type VaultVersion } from './graphql'
import { fetchMultipleVaultsPPS, getPPS, type PPSTimeline } from './kong'
import { fetchMultipleVaultsMetadata } from './vaults'

interface VaultEvents {
  deposits: DepositEvent[]
  withdrawals: WithdrawEvent[]
  transfersIn: TransferEvent[]
  transfersOut: TransferEvent[]
}

interface ProcessedVault {
  vaultAddress: string
  chainId: number
  fifoLots: FifoLot[]
  totalDeposited: bigint // in underlying token (raw)
  totalWithdrawn: bigint // in underlying token (raw)
  realizedPnL: bigint // in underlying token (raw)
  remainingShares: bigint
  remainingCostBasis: bigint // in underlying token (raw)
}

function groupEventsByVault(events: {
  deposits: DepositEvent[]
  withdrawals: WithdrawEvent[]
  transfersIn: TransferEvent[]
  transfersOut: TransferEvent[]
}): Map<string, VaultEvents> {
  const vaultMap = new Map<string, VaultEvents>()

  const getOrCreate = (vaultAddress: string, chainId: number): VaultEvents => {
    const key = `${chainId}:${vaultAddress.toLowerCase()}`
    if (!vaultMap.has(key)) {
      vaultMap.set(key, {
        deposits: [],
        withdrawals: [],
        transfersIn: [],
        transfersOut: []
      })
    }
    return vaultMap.get(key)!
  }

  for (const d of events.deposits) {
    getOrCreate(d.vaultAddress, d.chainId).deposits.push(d)
  }
  for (const w of events.withdrawals) {
    getOrCreate(w.vaultAddress, w.chainId).withdrawals.push(w)
  }
  for (const t of events.transfersIn) {
    getOrCreate(t.vaultAddress, t.chainId).transfersIn.push(t)
  }
  for (const t of events.transfersOut) {
    getOrCreate(t.vaultAddress, t.chainId).transfersOut.push(t)
  }

  return vaultMap
}

interface ProcessVaultOptions {
  // PPS timeline for cost basis estimation on transfer_in events
  // For staking vaults: use underlying vault PPS
  // For regular vaults: use the vault's own PPS
  ppsForCostBasis?: PPSTimeline
}

function processVaultPnL(
  vaultAddress: string,
  chainId: number,
  events: VaultEvents,
  options: ProcessVaultOptions = {}
): ProcessedVault {
  // Debug both the underlying vault and the staking vault
  const DEBUG_VAULTS = [
    '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204', // yvUSDC-1
    '0x622fa41799406b120f9a40da843d358b7b2cfee3' // yG-yvUSDC-1 (staking)
  ]
  const debug = DEBUG_VAULTS.includes(vaultAddress.toLowerCase())
  const { ppsForCostBasis } = options

  // Combine all events that affect share balance, sorted by timestamp
  type ShareEvent = {
    timestamp: number
    txHash: string
    shares: bigint
    assets: bigint | null // null for transfers (unknown cost basis)
    type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out'
  }

  const allEvents: ShareEvent[] = []

  for (const d of events.deposits) {
    allEvents.push({
      timestamp: d.blockTimestamp,
      txHash: d.transactionHash,
      shares: BigInt(d.shares),
      assets: BigInt(d.assets),
      type: 'deposit'
    })
  }

  for (const w of events.withdrawals) {
    allEvents.push({
      timestamp: w.blockTimestamp,
      txHash: w.transactionHash,
      shares: BigInt(w.shares),
      assets: BigInt(w.assets),
      type: 'withdrawal'
    })
  }

  for (const t of events.transfersIn) {
    allEvents.push({
      timestamp: t.blockTimestamp,
      txHash: t.transactionHash,
      shares: BigInt(t.value),
      assets: null, // Unknown cost basis for transfers
      type: 'transfer_in'
    })
  }

  for (const t of events.transfersOut) {
    allEvents.push({
      timestamp: t.blockTimestamp,
      txHash: t.transactionHash,
      shares: BigInt(t.value),
      assets: null,
      type: 'transfer_out'
    })
  }

  // Sort by timestamp
  allEvents.sort((a, b) => a.timestamp - b.timestamp)

  if (debug) {
    console.log('\n════════════════════════════════════════════════════════════')
    console.log(`FIFO PnL Breakdown for ${vaultAddress}`)
    console.log('════════════════════════════════════════════════════════════')
    console.log('\n📋 All Events (chronological):')
    allEvents.forEach((e, i) => {
      console.log(
        `  [${i}] ${e.type.toUpperCase().padEnd(12)} | shares: ${e.shares.toString().padStart(10)} | assets: ${e.assets?.toString().padStart(10) ?? 'null'.padStart(10)} | ts: ${e.timestamp} | tx: ${e.txHash}`
      )
    })
  }

  // Process events to build FIFO lots and calculate PnL
  const fifoLots: FifoLot[] = []
  let totalDeposited = BigInt(0)
  let totalWithdrawn = BigInt(0)
  let realizedPnL = BigInt(0)
  let fifoIndex = 0
  let consumedFromCurrentLot = BigInt(0)
  let lotCounter = 0

  if (debug) console.log('\n📦 Processing Events:')

  for (const event of allEvents) {
    if (event.type === 'deposit') {
      // Add new FIFO lot - store assets as BigInt to preserve precision
      fifoLots.push({
        shares: event.shares,
        assets: event.assets ?? BigInt(0),
        timestamp: event.timestamp
      })
      totalDeposited += event.assets ?? BigInt(0)

      if (debug) {
        console.log(`\n  ➕ DEPOSIT: ${event.shares} shares for ${event.assets} assets`)
        console.log(`     → Created Lot #${lotCounter++}: shares=${event.shares}, assets=${event.assets}`)
        console.log(`     → totalDeposited now: ${totalDeposited}`)
      }
    } else if (event.type === 'transfer_in') {
      // Estimate cost basis using PPS at transfer time
      // For staking vaults: uses underlying vault PPS (staking shares are 1:1 with underlying)
      // For regular vaults: uses the vault's own PPS
      // Cost basis = shares × PPS at transfer time
      let estimatedAssets = BigInt(0)

      if (ppsForCostBasis && ppsForCostBasis.size > 0) {
        const ppsAtTime = getPPS(ppsForCostBasis, event.timestamp)
        // shares × PPS gives us the value in underlying tokens
        estimatedAssets = BigInt(Math.floor(Number(event.shares) * ppsAtTime))
        totalDeposited += estimatedAssets
      }

      fifoLots.push({
        shares: event.shares,
        assets: estimatedAssets,
        timestamp: event.timestamp
      })

      if (debug) {
        if (ppsForCostBasis && ppsForCostBasis.size > 0) {
          const ppsAtTime = getPPS(ppsForCostBasis, event.timestamp)
          console.log(`\n  📥 TRANSFER_IN: ${event.shares} shares`)
          console.log(`     → PPS at time: ${ppsAtTime.toFixed(6)}`)
          console.log(`     → Estimated cost basis: ${event.shares} × ${ppsAtTime.toFixed(6)} = ${estimatedAssets}`)
          console.log(`     → Created Lot #${lotCounter++}: shares=${event.shares}, assets=${estimatedAssets}`)
          console.log(`     → totalDeposited now: ${totalDeposited}`)
        } else {
          console.log(`\n  📥 TRANSFER_IN: ${event.shares} shares (no PPS data, cost basis = 0)`)
          console.log(`     → Created Lot #${lotCounter++}: shares=${event.shares}, assets=0`)
        }
      }
    } else if (event.type === 'withdrawal') {
      // Process withdrawal using FIFO
      let sharesToConsume = event.shares
      let costBasis = BigInt(0)

      if (debug) {
        console.log(`\n  💸 WITHDRAWAL: ${event.shares} shares for ${event.assets} assets`)
        console.log(`     → Need to consume ${sharesToConsume} shares from FIFO queue`)
      }

      while (sharesToConsume > 0n && fifoIndex < fifoLots.length) {
        const lot = fifoLots[fifoIndex]
        const availableInLot = lot.shares - consumedFromCurrentLot
        const take = sharesToConsume < availableInLot ? sharesToConsume : availableInLot

        // Calculate cost basis using BigInt math: (take * lot.assets) / lot.shares
        // This preserves precision - no floating point conversion
        const costForTake = lot.shares > 0n ? (take * lot.assets) / lot.shares : BigInt(0)
        costBasis += costForTake

        if (debug) {
          console.log(
            `     → Lot #${fifoIndex}: take ${take}/${availableInLot} shares, cost = (${take} × ${lot.assets}) / ${lot.shares} = ${costForTake}`
          )
        }

        sharesToConsume -= take
        consumedFromCurrentLot += take

        if (consumedFromCurrentLot >= lot.shares) {
          if (debug) console.log(`       ✓ Lot #${fifoIndex} fully consumed`)
          fifoIndex++
          consumedFromCurrentLot = BigInt(0)
        }
      }

      // Realized PnL = tokens received - cost basis of shares burned
      const tokensReceived = event.assets ?? BigInt(0)
      const pnlForThisWithdrawal = tokensReceived - costBasis
      realizedPnL += pnlForThisWithdrawal
      totalWithdrawn += tokensReceived

      if (debug) {
        console.log(`     → Total cost basis for withdrawal: ${costBasis}`)
        console.log(`     → PnL = ${tokensReceived} - ${costBasis} = ${pnlForThisWithdrawal}`)
        console.log(`     → Running realizedPnL: ${realizedPnL}`)
      }
    } else if (event.type === 'transfer_out') {
      // Transfer out - consume from FIFO but no realized PnL (shares moved, not sold)
      let sharesToConsume = event.shares

      if (debug) {
        console.log(`\n  📤 TRANSFER_OUT: ${event.shares} shares (no PnL, just consume lots)`)
      }

      while (sharesToConsume > 0n && fifoIndex < fifoLots.length) {
        const lot = fifoLots[fifoIndex]
        const availableInLot = lot.shares - consumedFromCurrentLot
        const take = sharesToConsume < availableInLot ? sharesToConsume : availableInLot

        if (debug) {
          console.log(`     → Lot #${fifoIndex}: consume ${take}/${availableInLot} shares (no cost tracking)`)
        }

        sharesToConsume -= take
        consumedFromCurrentLot += take

        if (consumedFromCurrentLot >= lot.shares) {
          if (debug) console.log(`       ✓ Lot #${fifoIndex} fully consumed`)
          fifoIndex++
          consumedFromCurrentLot = BigInt(0)
        }
      }
    }
  }

  // Calculate remaining shares and their cost basis
  let remainingShares = BigInt(0)
  let remainingCostBasis = BigInt(0)

  for (let i = fifoIndex; i < fifoLots.length; i++) {
    const lot = fifoLots[i]
    const sharesInLot = i === fifoIndex ? lot.shares - consumedFromCurrentLot : lot.shares

    remainingShares += sharesInLot
    // Use BigInt math for cost basis
    const costForShares = lot.shares > 0n ? (sharesInLot * lot.assets) / lot.shares : BigInt(0)
    remainingCostBasis += costForShares
  }

  return {
    vaultAddress,
    chainId,
    fifoLots,
    totalDeposited,
    totalWithdrawn,
    realizedPnL,
    remainingShares,
    remainingCostBasis
  }
}

export async function calculatePnL(userAddress: string, version: VaultVersion = 'all'): Promise<PnLResponse> {
  // Fetch all user events
  const events = await fetchUserEvents(userAddress, version)

  // Group events by vault
  const vaultEventsMap = groupEventsByVault(events)

  if (vaultEventsMap.size === 0) {
    return {
      address: userAddress,
      summary: {
        totalDepositedUsd: 0,
        totalWithdrawnUsd: 0,
        currentValueUsd: 0,
        realizedPnLUsd: 0,
        unrealizedPnLUsd: 0,
        totalPnLUsd: 0,
        totalPnLPercent: 0
      },
      vaults: []
    }
  }

  // Get unique vaults
  const vaults = Array.from(vaultEventsMap.keys()).map((key) => {
    const [chainId, vaultAddress] = key.split(':')
    return { chainId: parseInt(chainId, 10), vaultAddress }
  })

  // Identify staking vaults and collect their underlying vaults
  const underlyingVaultsToFetch: Array<{ chainId: number; vaultAddress: string }> = []
  const stakingToUnderlyingMap = new Map<string, string>() // staking key -> underlying key

  for (const vault of vaults) {
    const underlying = getUnderlyingVault(vault.vaultAddress)
    if (underlying) {
      const stakingKey = `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`
      const underlyingKey = `${underlying.chainId}:${underlying.underlying.toLowerCase()}`
      stakingToUnderlyingMap.set(stakingKey, underlyingKey)
      underlyingVaultsToFetch.push({
        chainId: underlying.chainId,
        vaultAddress: underlying.underlying
      })
    }
  }

  // Fetch metadata and PPS for both user's vaults AND underlying vaults of staking positions
  const allVaultsToFetch = [...vaults, ...underlyingVaultsToFetch]
  const [vaultMetadata, ppsData] = await Promise.all([
    fetchMultipleVaultsMetadata(allVaultsToFetch),
    fetchMultipleVaultsPPS(allVaultsToFetch)
  ])

  // Get current timestamp for price lookup
  const now = Math.floor(Date.now() / 1000)

  // Collect underlying tokens for price fetch
  const underlyingTokens: Array<{ chainId: number; address: string }> = []
  const seenTokens = new Set<string>()

  for (const [_key, metadata] of vaultMetadata) {
    const tokenKey = `${metadata.chainId}:${metadata.token.address.toLowerCase()}`
    if (!seenTokens.has(tokenKey)) {
      seenTokens.add(tokenKey)
      underlyingTokens.push({
        chainId: metadata.chainId,
        address: metadata.token.address
      })
    }
  }

  // Fetch current token prices
  const priceData = await fetchHistoricalPrices(underlyingTokens, [now])

  // Process each vault
  const vaultPnLs: VaultPnL[] = []

  for (const [key, vaultEvents] of vaultEventsMap) {
    const [chainIdStr, vaultAddress] = key.split(':')
    const chainId = parseInt(chainIdStr, 10)
    const metadata = vaultMetadata.get(key)

    if (!metadata) {
      continue
    }

    const decimals = metadata.decimals
    const tokenDecimals = metadata.token.decimals

    // Get PPS for cost basis estimation on transfer_in events
    // For staking vaults: use underlying vault PPS (staking shares are 1:1 with underlying)
    // For regular vaults: use the vault's own PPS
    const underlyingKey = stakingToUnderlyingMap.get(key)
    const ppsForCostBasis = underlyingKey ? ppsData.get(underlyingKey) : ppsData.get(key)

    // Process FIFO and calculate PnL
    const processed = processVaultPnL(vaultAddress, chainId, vaultEvents, {
      ppsForCostBasis
    })
    if (vaultAddress === '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204'.toLowerCase()) {
      console.log(processed)
    }
    // Skip if no remaining shares
    if (processed.remainingShares === BigInt(0) && processed.realizedPnL === BigInt(0)) {
      continue
    }

    // Get current PPS
    const ppsTimeline = ppsData.get(key)
    const currentPPS = ppsTimeline ? getPPS(ppsTimeline, now) : 1.0

    // Get current token price
    const priceKey = `${getChainPrefix(chainId)}:${metadata.token.address.toLowerCase()}`
    const tokenPriceMap = priceData.get(priceKey)
    const tokenPrice = tokenPriceMap?.get(now) ?? 0

    // Convert to human-readable numbers
    const sharesFloat = Number(processed.remainingShares) / 10 ** decimals
    const currentValueTokens = sharesFloat * currentPPS
    const currentValueUsd = currentValueTokens * tokenPrice

    const remainingCostBasisTokens = Number(processed.remainingCostBasis) / 10 ** tokenDecimals
    const unrealizedPnLTokens = currentValueTokens - remainingCostBasisTokens
    const unrealizedPnLUsd = unrealizedPnLTokens * tokenPrice

    const realizedPnLTokens = Number(processed.realizedPnL) / 10 ** tokenDecimals
    const realizedPnLUsd = realizedPnLTokens * tokenPrice

    const totalDepositedTokens = Number(processed.totalDeposited) / 10 ** tokenDecimals
    const totalWithdrawnTokens = Number(processed.totalWithdrawn) / 10 ** tokenDecimals

    vaultPnLs.push({
      vaultAddress,
      chainId,
      tokenSymbol: metadata.token.symbol,
      tokenDecimals,
      totalDeposited: totalDepositedTokens,
      totalWithdrawn: totalWithdrawnTokens,
      currentShares: sharesFloat,
      currentValue: currentValueTokens,
      realizedPnL: realizedPnLTokens,
      unrealizedPnL: unrealizedPnLTokens,
      totalPnL: realizedPnLTokens + unrealizedPnLTokens,
      currentValueUsd,
      realizedPnLUsd,
      unrealizedPnLUsd,
      totalPnLUsd: realizedPnLUsd + unrealizedPnLUsd
    })
  }

  // Calculate summary
  const summary = {
    totalDepositedUsd: 0,
    totalWithdrawnUsd: 0,
    currentValueUsd: 0,
    realizedPnLUsd: 0,
    unrealizedPnLUsd: 0,
    totalPnLUsd: 0,
    totalPnLPercent: 0
  }

  for (const vault of vaultPnLs) {
    summary.currentValueUsd += vault.currentValueUsd
    summary.realizedPnLUsd += vault.realizedPnLUsd
    summary.unrealizedPnLUsd += vault.unrealizedPnLUsd
    summary.totalPnLUsd += vault.totalPnLUsd

    // For USD deposits/withdrawals, we'd need historical prices at deposit time
    // For now, use current price as approximation for summary
    const tokenKey = `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`
    const metadata = vaultMetadata.get(tokenKey)
    if (metadata) {
      const priceKey = `${getChainPrefix(vault.chainId)}:${metadata.token.address.toLowerCase()}`
      const tokenPriceMap = priceData.get(priceKey)
      const tokenPrice = tokenPriceMap?.get(now) ?? 0
      summary.totalDepositedUsd += vault.totalDeposited * tokenPrice
      summary.totalWithdrawnUsd += vault.totalWithdrawn * tokenPrice
    }
  }

  // Calculate percentage gain
  const netDeposited = summary.totalDepositedUsd - summary.totalWithdrawnUsd
  if (netDeposited > 0) {
    summary.totalPnLPercent = (summary.totalPnLUsd / netDeposited) * 100
  }

  return {
    address: userAddress,
    summary,
    vaults: vaultPnLs
  }
}
