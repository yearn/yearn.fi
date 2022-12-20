import {useCallback, useMemo} from 'react';
import {BigNumber, constants} from 'ethers';
import {getTokenAllowance, quote} from 'wido';
import useSWRMutation from 'swr/mutation';
import {isZeroAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {ethers} from 'ethers';
import type {QuoteRequest, QuoteResult, TokenAllowanceRequest} from 'wido';

type TUseWido = {
    allowance: (request: TokenAllowanceRequest) => Promise<BigNumber>;
	widoQuote: TWidoResult;
    getWidoQuote: (request: QuoteRequest) => Promise<void>;
    zap: (provider: ethers.providers.Web3Provider, request: QuoteRequest) => Promise<boolean>;
}

type TWidoResult = {
	isLoading: boolean,
	result?: QuoteResult,
	error?: Error
}

export function useWidoQuote(): Pick<TUseWido, 'widoQuote' | 'getWidoQuote'> {
	const defaultProps: QuoteRequest = {fromChainId: 1, fromToken: '', toChainId: 1, toToken: ''};
	const {data: result, error, trigger, isMutating: isLoading} = useSWRMutation(defaultProps, quote, {});

	const	getWidoQuote = useCallback(async (request: QuoteRequest): Promise<void> => {
		const {fromToken, toToken, amount} = request;
		const canExecuteFetch = !(isZeroAddress(fromToken) || isZeroAddress(toToken) && !formatBN(amount || 0).isZero());
		if (canExecuteFetch) {
			trigger(request, {revalidate: false});
		}
	}, [trigger]);

	return {
		widoQuote: useMemo((): TWidoResult => ({result, isLoading, error}), [error, isLoading, result]),
		getWidoQuote
	};
}

export function useWido(): TUseWido {
	const {widoQuote, getWidoQuote} = useWidoQuote();

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
    
	return {allowance, widoQuote, getWidoQuote, zap};
}
