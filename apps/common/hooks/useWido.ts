import {BigNumber, constants} from 'ethers';
import {getTokenAllowance, quote} from 'wido';

import type {ethers} from 'ethers';
import type {QuoteRequest, QuoteResult, TokenAllowanceRequest} from 'wido';

type TUseWido = {
    allowance: (request: TokenAllowanceRequest) => Promise<BigNumber>;
    quote: (request: QuoteRequest) => Promise<QuoteResult>;
    zap: (provider: ethers.providers.Web3Provider, request: QuoteRequest) => Promise<boolean>;
}

export function useWido(): TUseWido {
	async function allowance(request: TokenAllowanceRequest): Promise<BigNumber> {
		try {
			const {allowance} = await getTokenAllowance(request);
			return BigNumber.from(allowance);
		} catch (error) {
			console.error(error);
			return constants.Zero;
		}
	}

	async function zap(provider: ethers.providers.Web3Provider, request: QuoteRequest): Promise<boolean> {
		try {
			const {data, to} = await quote(request);
            
			const signer = provider.getSigner();
			const tx = await signer.sendTransaction({data, to});
    
			await tx.wait();
    
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	}
    
	return {quote, allowance, zap};
}
