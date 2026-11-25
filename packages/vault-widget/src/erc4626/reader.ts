import { toNormalizedBN } from '@yearn/vault-widget/internal/utils'
import type { Token, VaultUserData, VaultWidgetVault } from '@yearn/vault-widget/types'
import { type Address, erc20Abi, erc4626Abi, getAddress, type PublicClient, zeroAddress } from 'viem'

export type TErc4626Client = Pick<PublicClient, 'readContract' | 'getCode' | 'getBlockNumber'>
export type TErc4626Snapshot = { vault: VaultWidgetVault; user: Omit<VaultUserData, 'isLoading' | 'refetch'> }

export class InvalidErc4626VaultError extends Error {}

function requireDecimals(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error('Unable to read token decimals.')
  return value
}

/** Read one coherent snapshot without any catalog, price feed, or Yearn-specific methods. */
export async function readErc4626Vault({
  client,
  address,
  chainId,
  account
}: {
  client: TErc4626Client
  address: Address
  chainId: number
  account?: Address
}): Promise<TErc4626Snapshot> {
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
  const code = await client.getCode({ address, blockNumber })
  if (!code || code === '0x') throw new InvalidErc4626VaultError('No vault contract at this address on this network.')
  const assetAddress = getAddress(
    await client.readContract({ address, abi: erc4626Abi, functionName: 'asset', blockNumber })
  )
  if (assetAddress === zeroAddress)
    throw new InvalidErc4626VaultError('This contract does not expose a valid vault asset.')
  const metadata = async (token: Address) => {
    const [decimals, symbol, name] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals', blockNumber }),
      client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol', blockNumber }).catch(() => 'Token'),
      client
        .readContract({ address: token, abi: erc20Abi, functionName: 'name', blockNumber })
        .catch(() => 'Unnamed token')
    ])
    return { address: token, decimals: requireDecimals(decimals), symbol, name }
  }
  const [vaultMeta, assetMeta] = await Promise.all([metadata(address), metadata(assetAddress)])
  const balance = (token: Address) =>
    account
      ? client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account], blockNumber })
      : Promise.resolve(0n)
  const [shares, assets, maxDeposit, maxWithdraw, contractMaxRedeem] = await Promise.all([
    balance(address),
    balance(assetAddress),
    client.readContract({
      address,
      abi: erc4626Abi,
      functionName: 'maxDeposit',
      args: [account ?? zeroAddress],
      blockNumber
    }),
    account
      ? client.readContract({ address, abi: erc4626Abi, functionName: 'maxWithdraw', args: [account], blockNumber })
      : 0n,
    account
      ? client.readContract({ address, abi: erc4626Abi, functionName: 'maxRedeem', args: [account], blockNumber })
      : 0n
  ])
  const maxRedeem = contractMaxRedeem < shares ? contractMaxRedeem : shares
  const [depositedValue, redeemableAssets] = await Promise.all([
    client.readContract({ address, abi: erc4626Abi, functionName: 'convertToAssets', args: [shares], blockNumber }),
    maxRedeem > 0n
      ? client.readContract({ address, abi: erc4626Abi, functionName: 'previewRedeem', args: [maxRedeem], blockNumber })
      : 0n
  ])
  const token = (meta: typeof assetMeta, amount: bigint): Token => ({
    ...meta,
    chainId,
    balance: toNormalizedBN(amount, meta.decimals)
  })
  return {
    vault: { ...vaultMeta, chainId, asset: assetMeta, contractKind: 'erc4626', isRetired: false },
    user: {
      assetToken: token(assetMeta, assets),
      vaultToken: token(vaultMeta, shares),
      stakingToken: undefined,
      // Legacy-only field. Generic flows use exact contract conversions and previews instead.
      pricePerShare: 0n,
      availableToDeposit: assets < maxDeposit ? assets : maxDeposit,
      depositedShares: shares,
      depositedValue,
      stakingWithdrawableAssets: 0n,
      stakingRedeemableShares: 0n,
      erc4626: { maxDeposit, maxWithdraw, maxRedeem, redeemableAssets }
    }
  }
}

export function getErc4626ReadMessage(error: unknown): string {
  return error instanceof InvalidErc4626VaultError
    ? error.message
    : 'Unable to read this ERC-4626 vault. Check the network and address, then retry.'
}
