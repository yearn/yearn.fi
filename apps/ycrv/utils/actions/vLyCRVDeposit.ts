import {ethers} from 'ethers';
import {VLYCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import VLYCRV_ABI from '../abi/vlYCrv.abi';

import type {TVlyCRVDepositProps} from './types';

export async function vLyCRVDeposit({provider, amount}: TVlyCRVDepositProps): Promise<boolean> {
	const signer = provider.getSigner();

	try {
		const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
		const transaction = await contract.deposit(amount);
		const transactionResult = await transaction.wait();
		if (transactionResult.status === 0) {
			throw new Error('Fail to perform transaction');
		}

		return true;
	} catch(error) {
		console.error(error);
		return false;
	}
}
