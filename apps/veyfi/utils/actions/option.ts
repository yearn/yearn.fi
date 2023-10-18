import {VEYFI_OPTIONS_ABI} from '@veYFI/utils/abi/veYFIOptions.abi';
import {handleTx} from '@yearn-finance/web-lib/utils/wagmi/provider';
import {assertAddress} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {assert} from '@common/utils/assert';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TWriteTransaction} from '@yearn-finance/web-lib/utils/wagmi/provider';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

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
