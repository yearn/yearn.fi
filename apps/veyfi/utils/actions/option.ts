import VEYFI_OPTIONS_ABI from '@veYFI/utils/abi/veYFIOptions.abi';
import {assert} from '@common/utils/assert';
import {assertAddress, handleTx as handleTxWagmi} from '@common/utils/wagmiUtils';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/wagmiUtils';

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
		value: props.ethRequired,
		args: [props.amount, props.accountAddress]
	});
}
