import {assert, assertAddress} from '@builtbymom/web3/utils';
import {handleTx} from '@builtbymom/web3/utils/wagmi';
import {VEYFI_OPTIONS_ABI} from '@veYFI/utils/abi/veYFIOptions.abi';

import type {TAddress} from '@builtbymom/web3/types';
import type {TTxResponse, TWriteTransaction} from '@builtbymom/web3/utils/wagmi';

type TRedeem = TWriteTransaction & {
	accountAddress: TAddress;
	amount: bigint;
	ethRequired: bigint;
};
export async function redeem(props: TRedeem): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.accountAddress);
	assert(props.amount > 0n, 'amount is zero');
	assert(props.ethRequired > 0n, 'ethRequired is zero');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_OPTIONS_ABI,
		functionName: 'redeem',
		value: props.ethRequired,
		args: [props.amount, props.accountAddress]
	});
}
