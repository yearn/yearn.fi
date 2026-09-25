import { type Address, decodeEventLog, erc20Abi, type TransactionReceipt } from 'viem'

/** Attribute received shares to this confirmed unstake, excluding unrelated wallet balance changes. */
export function getUnstakedShares(
  receipt: TransactionReceipt,
  token: Address,
  staking: Address,
  owner: Address
): bigint {
  if (receipt.status !== 'success') throw new Error('Unstake did not succeed')
  const received = receipt.logs.reduce((total, log) => {
    if (log.address.toLowerCase() !== token.toLowerCase()) return total
    try {
      const event = decodeEventLog({ abi: erc20Abi, eventName: 'Transfer', data: log.data, topics: log.topics })
      if (
        event.args.from.toLowerCase() === staking.toLowerCase() &&
        event.args.to.toLowerCase() === owner.toLowerCase()
      )
        return total + event.args.value
      return total
    } catch {
      return total
    }
  }, 0n)
  if (received <= 0n)
    throw new Error('Could not establish the shares received from this unstake. Review before withdrawing.')
  return received
}
