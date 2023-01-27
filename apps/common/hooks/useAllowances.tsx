import {useCallback} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {ERC20_ABI} from '@yearn-finance/web-lib/utils/abi';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {Call} from 'ethcall';
import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type TAllowanceRequest = {
	token: TAddress,
	spender?: TAddress
}

export const useAllowances = (allowanceRequests: TAllowanceRequest[]): [TDict<BigNumber | undefined>, boolean, () => void] => {
	const {provider, address: userAddress, isActive} = useWeb3();
	const {chainID} = useChainID();

	const allowancesFetcher = useCallback(async (): Promise<TDict<BigNumber>> => {
		if (!isActive || !userAddress) {
			return {};
		}
		const currentProvider = getProvider(chainID);
		const ethcallProvider = await newEthCallProvider(currentProvider);

		const allowanceCalls = allowanceRequests.map(({token, spender}): Call => {
			const erc20Contract = new Contract(token, ERC20_ABI);
			return erc20Contract.allowance(userAddress, toAddress(spender));
		});
		const allowances = await ethcallProvider.tryAll(allowanceCalls) as BigNumber[];
		const allowancesMap: TDict<BigNumber> = {};
		allowanceRequests.forEach(({token, spender}, index): void => {
			allowancesMap[allowanceKey(token, spender)] = allowances[index];
		});

		return allowancesMap;
	}, [allowanceRequests, chainID, isActive, userAddress]);
	const {data: allowancesMap, isLoading, mutate: refresh} = useSWR(isActive && provider ? allowanceRequests : null, allowancesFetcher, {shouldRetryOnError: false});
	
	return [allowancesMap || {}, isLoading, refresh];
};
