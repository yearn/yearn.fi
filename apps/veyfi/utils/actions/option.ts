import {assert} from 'vitest';
import VEYFI_OPTIONS_ABI from '@veYFI/utils/abi/veYFIOptions.abi';
import {assertAddress, handleTx as handleTxWagmi} from '@common/utils/toWagmiProvider';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

type TRedeem = TWriteTransaction & {
	accountAddress: TAddress;
	amount: bigint;
	ethRequired: bigint;
};
export async function redeem(props: TRedeem): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.accountAddress);
	assert(props.amount > 0n, 'amount is zero');

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_OPTIONS_ABI,
		functionName: 'exercise',
		args: [props.amount, props.accountAddress, {value: props.ethRequired}]
	});
}
