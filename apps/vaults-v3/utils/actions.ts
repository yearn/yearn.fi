import {assert, assertAddress} from '@builtbymom/web3/utils';
import {handleTx, toWagmiProvider} from '@builtbymom/web3/utils/wagmi';
import {TOKENIZED_STRATEGY_ABI} from '@vaults-v3/utils/abi/tokenizedStrategy.abi';

import type {TTxResponse, TWriteTransaction} from '@builtbymom/web3/utils/wagmi';

/* 🔵 - Yearn Finance **********************************************************
 ** stake is a _WRITE_ function that stake the shares of the vault into the
 ** staking contract.
 **
 ** @app - Vaults (optimism)
 ** @param amount - The amount of the underlying asset to deposit.
 ******************************************************************************/
type TStake = TWriteTransaction & {
	amount: bigint;
};
export async function stake(props: TStake): Promise<TTxResponse> {
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);

	const wagmiProvider = await toWagmiProvider(props.connector);
	assertAddress(wagmiProvider.address, 'ownerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: TOKENIZED_STRATEGY_ABI,
		functionName: 'deposit',
		args: [props.amount, wagmiProvider.address]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** stake is a _WRITE_ function that unstake the shares of the vault from the
 ** staking contract.
 **
 ** @app - Vaults (optimism)
 ******************************************************************************/
type TUnstake = TWriteTransaction;
export async function unstake(props: TUnstake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	const wagmiProvider = await toWagmiProvider(props.connector);
	assertAddress(wagmiProvider.address, 'ownerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: TOKENIZED_STRATEGY_ABI,
		functionName: 'redeem',
		args: [props.amount, wagmiProvider.address, wagmiProvider.address]
	});
}
