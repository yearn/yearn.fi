import type { TErc4626Client, TErc4626Snapshot } from '@yearn/vault-widget/erc4626/reader'
import { vaultAbi } from '@yearn/vault-widget/internal/contracts/abi/vaultV2.abi'
import { toNormalizedBN } from '@yearn/vault-widget/internal/utils'
import type { Token } from '@yearn/vault-widget/types'
import { type Address, erc20Abi, getAddress, zeroAddress } from 'viem'

/** Explicitly selected Yearn V2 factory contracts use token(), PPS and share-based withdrawals. */
export async function readFactoryVault({
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
  if (!code || code === '0x') throw new Error('No factory vault contract at this address.')
  const assetAddress = getAddress(
    await client.readContract({ address, abi: vaultAbi, functionName: 'token', blockNumber })
  )
  if (assetAddress === zeroAddress) throw new Error('The factory vault has no valid underlying token.')
  const metadata = async (token: Address) => {
    const [decimals, symbol, name] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals', blockNumber }),
      client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol', blockNumber }),
      client.readContract({ address: token, abi: erc20Abi, functionName: 'name', blockNumber })
    ])
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255)
      throw new Error('Invalid factory token decimals.')
    return { address: token, decimals, symbol, name }
  }
  const balance = (token: Address) =>
    account
      ? client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account], blockNumber })
      : Promise.resolve(0n)
  const [vaultMeta, assetMeta, shares, assets, pricePerShare, depositLimit, shutdown, version] = await Promise.all([
    metadata(address),
    metadata(assetAddress),
    balance(address),
    balance(assetAddress),
    client.readContract({ address, abi: vaultAbi, functionName: 'pricePerShare', blockNumber }),
    client.readContract({ address, abi: vaultAbi, functionName: 'availableDepositLimit', blockNumber }),
    client.readContract({ address, abi: vaultAbi, functionName: 'emergencyShutdown', blockNumber }),
    client.readContract({ address, abi: vaultAbi, functionName: 'apiVersion', blockNumber })
  ])
  if (pricePerShare <= 0n) throw new Error('Factory vault share value is unavailable.')
  const maxDeposit = shutdown ? 0n : depositLimit
  const token = (meta: typeof assetMeta, amount: bigint): Token => ({
    ...meta,
    chainId,
    balance: toNormalizedBN(amount, meta.decimals)
  })
  return {
    vault: { ...vaultMeta, chainId, asset: assetMeta, version, contractKind: 'yearn-v2', isRetired: false },
    user: {
      assetToken: token(assetMeta, assets),
      vaultToken: token(vaultMeta, shares),
      stakingToken: undefined,
      pricePerShare,
      availableToDeposit: assets < maxDeposit ? assets : maxDeposit,
      depositedShares: shares,
      depositedValue: (shares * pricePerShare) / 10n ** BigInt(vaultMeta.decimals),
      stakingWithdrawableAssets: 0n,
      stakingRedeemableShares: 0n,
      yearnV2: { maxDeposit }
    }
  }
}
