import {ethers} from 'ethers';
import {VLYCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import VLYCRV_ABI from '../abi/vlYCrv.abi';
import {handleTx} from './handleTx';

import type {TVoteTxProps} from './types';

export async function vLyCRVVote({provider, gaugeAddress, votes}: TVoteTxProps): Promise<boolean> {
	const signer = provider.getSigner();

	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return handleTx(contract.vote(gaugeAddress, votes));
}
