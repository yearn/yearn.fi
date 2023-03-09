import {useCallback} from 'react';
import {ethers} from 'ethers';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {TNormalizedBN} from '@yearn-finance/web-lib/types';
import type {TDropdownOption} from '@common/types/types';

export type TVaultEstimateOutFetcher = [
    inputToken: TDropdownOption,
    outputToken: TDropdownOption,
	inputAmount: bigint,
	isDepositing: boolean
]

export function	useVaultEstimateOutFetcher(): (args: TVaultEstimateOutFetcher) => Promise<TNormalizedBN> {
	const {provider, chainID} = useWeb3();

	const retrieveExpectedOut = useCallback(async (args: TVaultEstimateOutFetcher): Promise<TNormalizedBN> => {
		const	[inputToken, outputToken, inputAmount, isDepositing] = args;

		if (isZero(inputToken?.value) || isZero(outputToken?.value) || isZero(inputAmount)) {
			return toNormalizedBN(0);
		}

		const	currentProvider = provider || getProvider(chainID);
		const	contract = new ethers.Contract(
			toAddress(isDepositing ? outputToken.value : inputToken.value),
			['function pricePerShare() public view returns (uint256)'],
			currentProvider
		);
		try {
			const	pps = toBigInt(await contract.pricePerShare());
			if (isDepositing) {
				const expectedOutFetched = inputAmount * toBigInt(10) ** toBigInt(outputToken?.decimals) / pps;
				return toNormalizedBN(expectedOutFetched, toBigInt(outputToken?.decimals || 18));
			}
			const expectedOutFetched = inputAmount * pps / toBigInt(10) ** toBigInt(outputToken?.decimals);
			return toNormalizedBN(expectedOutFetched, toBigInt(outputToken?.decimals || 18));
		} catch (error) {
			console.error(error);
			return toNormalizedBN(0);
		}
	}, [provider, chainID]);

	return retrieveExpectedOut;
}
