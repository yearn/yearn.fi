import type {
  TTenderlyFundRequest,
  TTenderlyIncreaseTimeRequest,
  TTenderlySnapshotRecord,
  TTenderlySnapshotRequest
} from '@shared/types/localFork'
import { getAddress, numberToHex, parseUnits } from 'viem'

import { callAnvil } from '@/config/localFork'

export { getLocalAnvilRpcUri, readAnvilInstance } from '@/config/localFork'

const HEX_QUANTITY = /^0x[\da-f]+$/i

export async function createAnvilSnapshot(
  rpcUri: string,
  executionChainId: number,
  request: TTenderlySnapshotRequest
): Promise<TTenderlySnapshotRecord> {
  const snapshotId = await callAnvil(rpcUri, 'evm_snapshot')
  if (typeof snapshotId !== 'string' || !HEX_QUANTITY.test(snapshotId)) {
    throw new Error('Anvil returned an invalid snapshot ID')
  }

  const kind = request.isBaseline ? 'baseline' : 'snapshot'
  const createdAt = new Date().toISOString()
  const prefix = request.isBaseline ? 'Baseline' : 'Snapshot'
  return {
    snapshotId,
    canonicalChainId: request.canonicalChainId,
    executionChainId,
    label: request.label?.trim() || `${prefix} ${createdAt.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')}`,
    createdAt,
    kind,
    lastKnownStatus: 'valid'
  }
}

export async function revertAnvilSnapshot(rpcUri: string, snapshotId: string): Promise<void> {
  if (!HEX_QUANTITY.test(snapshotId)) {
    throw new Error('Invalid Anvil snapshot ID')
  }
  if ((await callAnvil(rpcUri, 'evm_revert', [snapshotId])) !== true) {
    throw new Error(`Anvil rejected revert for snapshot ${snapshotId}`)
  }
}

export async function increaseAnvilTime(
  rpcUri: string,
  { seconds, mineBlock }: Omit<TTenderlyIncreaseTimeRequest, 'canonicalChainId'>
): Promise<void> {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error('Seconds must be a positive integer')
  }

  await callAnvil(rpcUri, 'evm_increaseTime', [numberToHex(seconds)])
  if (mineBlock) {
    await callAnvil(rpcUri, 'evm_mine')
  }
}

export async function fundAnvilWallet(rpcUri: string, request: TTenderlyFundRequest): Promise<void> {
  const walletAddress = getAddress(request.walletAddress)
  const amount = request.amount.trim()
  const decimals = request.decimals
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('Invalid decimals value')
  }
  if (!/^\d+(\.\d+)?$/.test(amount) || (amount.split('.')[1]?.length ?? 0) > decimals) {
    throw new Error(`Enter a non-negative amount with up to ${decimals} decimals`)
  }

  const units = parseUnits(amount, decimals)
  if (request.assetKind === 'erc20') {
    if (!request.tokenAddress) {
      throw new Error('Token address is required for ERC-20 funding')
    }
    await callAnvil(rpcUri, 'anvil_dealERC20', [walletAddress, getAddress(request.tokenAddress), numberToHex(units)])
    return
  }

  const balance = request.mode === 'set' ? '0x0' : await callAnvil(rpcUri, 'eth_getBalance', [walletAddress, 'latest'])
  if (typeof balance !== 'string' || !HEX_QUANTITY.test(balance)) {
    throw new Error('Anvil returned an invalid ETH balance')
  }

  await callAnvil(rpcUri, 'anvil_setBalance', [walletAddress, numberToHex(BigInt(balance) + units)])
}
