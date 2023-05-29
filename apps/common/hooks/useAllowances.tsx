import {useCallback} from 'react';
import {erc20ABI} from 'wagmi';
import {useAsync} from '@react-hookz/web';
import {multicall} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey, toAddress, toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {decodeAsBigInt} from '@yearn-finance/web-lib/utils/decoder';

import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

export type TAllowanceRequest = {
	token: TAddress,
	spender?: TAddress
}

export const useAllowances = (allowanceRequests: TAllowanceRequest[]): [TDict<bigint>, boolean, () => void] => {
	const {address: userAddress, isActive} = useWeb3();
	const {chainID} = useChainID();

	const allowancesFetcher = useCallback(async (): Promise<TDict<bigint>> => {
		if (!isActive || !userAddress) {
			return {};
		}
		const calls = [];
		for (const req of allowanceRequests) {
			const baseContract = {
				address: toWagmiAddress(req.token),
				abi: erc20ABI,
				chainId: chainID
			} as const;
			calls.push({...baseContract, functionName: 'allowance', args: [userAddress, toWagmiAddress(req.spender)]});
		}
		const results = await multicall({contracts: calls, chainId: chainID});
		const allowancesMap: TDict<bigint> = {};

		let index = 0;
		for (const req of allowanceRequests) {
			const key = allowanceKey(chainID, toAddress(req.token), toAddress(req.spender), userAddress);
			allowancesMap[key] = decodeAsBigInt(results[index++]);
		}
		return allowancesMap;
	}, [allowanceRequests, chainID, isActive, userAddress]);

	//TODO: Ensure this works
	const [{result: allowancesMap, status}, actions] = useAsync(async (): Promise<TDict<bigint>> => allowancesFetcher(), {});

	return [allowancesMap || {}, status === 'loading', actions.execute];
};
