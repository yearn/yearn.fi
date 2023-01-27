import {ethers} from 'ethers';
import {VLYCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import VLYCRV_ABI from '../abi/vlYCrv.abi';
import {handleTx} from './handleTx';

import type {TVlyCRVWithdrawProps} from './types';

export async function vLyCRVWithdraw({provider, amount}: TVlyCRVWithdrawProps): Promise<boolean> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return handleTx(contract.withdraw(amount));
}
