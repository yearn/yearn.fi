import {useCallback} from 'react';
import {ethers} from 'ethers';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

export type TAllowanceFetcher = [
	inputToken: TDropdownOption,
	spender: TAddress
]

export function	useAllowanceFetcher(): (args: TAllowanceFetcher) => Promise<TNormalizedBN> {
	const {provider} = useWeb3();

	const retrieveAllowance = useCallback(async (args: TAllowanceFetcher): Promise<TNormalizedBN> => {
		const	[inputToken, spender] = args;
		if (!inputToken || !provider) {
			return (toNormalizedBN(0));
		}
		const	currentProvider = provider;
		const	contract = new ethers.Contract(
			toAddress(inputToken.value),
			['function allowance(address _owner, address _spender) public view returns (uint256)'],
			currentProvider
		);
		const	address = await (provider as ethers.providers.Web3Provider).getSigner().getAddress();

		try {
			const	tokenAllowance = formatBN(await contract.allowance(address, spender));
			const	effectiveAllowance = toNormalizedBN(tokenAllowance, inputToken.decimals);
			return effectiveAllowance;
		} catch (error) {
			console.error(error);
			return (toNormalizedBN(0));
		}
	}, [provider]);

	return retrieveAllowance;
}
