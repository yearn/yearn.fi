import {ethers} from 'ethers';
import {VEYFI_OPTIONS_ADDRESS} from '@veYFI/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function redeem(
	provider: ethers.providers.JsonRpcProvider,
	accountAddress: TAddress,
	amount: BigNumber
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(VEYFI_OPTIONS_ADDRESS, [], signer); // TODO: update once deployed
	return handleTx(gaugeContract.exercise(amount, accountAddress));
}
