import { assert, assertAddress } from '@lib/utils'
import type { TTxResponse, TWriteTransaction } from '@lib/utils/wagmi'
import { handleTx, toWagmiProvider } from '@lib/utils/wagmi'
import { TOKENIZED_STRATEGY_ABI } from '@vaults-v3/utils/abi/tokenizedStrategy.abi'

/* 🔵 - Yearn Finance **********************************************************
 ** stake is a _WRITE_ function that stake the shares of the vault into the
 ** staking contract.
 **
 ** @app - yBOLD
 ** @param amount - The amount of the underlying asset to deposit.
 ******************************************************************************/
type TStake = TWriteTransaction & {
	amount: bigint
}
export async function stakeYBold(props: TStake): Promise<TTxResponse> {
	assert(props.amount > 0n, 'Amount is 0')
	assertAddress(props.contractAddress)

	const wagmiProvider = await toWagmiProvider(props.connector)
	assertAddress(wagmiProvider.address, 'ownerAddress')

	return await handleTx(props, {
		address: props.contractAddress,
		abi: TOKENIZED_STRATEGY_ABI,
		functionName: 'deposit',
		args: [props.amount, wagmiProvider.address]
	})
}

/* 🔵 - Yearn Finance **********************************************************
 ** unstake is a _WRITE_ function that withdraws the shares of the vault from the
 ** staking contract.
 **
 ** @app - yBOLD
 ******************************************************************************/
type TUnstake = TWriteTransaction & {
	amount: bigint
}
export async function unstakeYBold(props: TUnstake): Promise<TTxResponse> {
	assertAddress(props.contractAddress)
	const wagmiProvider = await toWagmiProvider(props.connector)
	assertAddress(wagmiProvider.address, 'ownerAddress')

	return await handleTx(props, {
		address: props.contractAddress,
		abi: TOKENIZED_STRATEGY_ABI,
		functionName: 'redeem',
		args: [props.amount, wagmiProvider.address, wagmiProvider.address]
	})
}
