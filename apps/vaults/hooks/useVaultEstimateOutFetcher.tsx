import {useCallback} from 'react';
import {ethers} from 'ethers';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

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
			return (toNormalizedBN(0));
		}

		const	currentProvider = provider || getProvider(chainID);
		const	contract = new ethers.Contract(
			toAddress(isDepositing ? outputToken.value : inputToken.value),
			['function pricePerShare() public view returns (uint256)'],
			currentProvider
		);
		try {
			const	pps = formatBN(await contract.pricePerShare());
			if (isDepositing) {
				const expectedOutFetched = inputAmount * (formatBN(10) ** BigInt(outputToken?.decimals || 18)) / pps;
				return toNormalizedBN(expectedOutFetched, outputToken?.decimals || 18);
			}
			const expectedOutFetched = inputAmount * pps / (formatBN(10) ** BigInt(outputToken?.decimals || 18));
			return toNormalizedBN(expectedOutFetched, outputToken?.decimals || 18);
		} catch (error) {
			console.error(error);
			return (toNormalizedBN(0));
		}
	}, [provider, chainID]);

	return retrieveExpectedOut;
}
