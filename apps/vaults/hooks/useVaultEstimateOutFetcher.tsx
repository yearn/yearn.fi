import {useCallback} from 'react';
import {ethers} from 'ethers';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {BigNumber} from 'ethers';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

export type TVaultEstimateOutFetcher = [
    inputToken: TDropdownOption,
    outputToken: TDropdownOption,
	inputAmount: BigNumber,
	isDepositing: boolean
]

export function	useVaultEstimateOutFetcher(): (args: TVaultEstimateOutFetcher) => Promise<TNormalizedBN> {
	const {provider, chainID} = useWeb3();

	const retrieveExpectedOut = useCallback(async (args: TVaultEstimateOutFetcher): Promise<TNormalizedBN> => {
		const	[inputToken, outputToken, inputAmount, isDepositing] = args;

		if (isZeroAddress(inputToken?.value) || isZeroAddress(outputToken?.value) || inputAmount?.isZero()) {
			return (toNormalizedBN(0));
		}

		const	currentProvider = provider || getProvider(chainID);
		const	contract = new ethers.Contract(
			toAddress(isDepositing ? outputToken.value : inputToken.value),
			['function pricePerShare() public view returns (uint256)'],
			currentProvider
		);
		try {
			const	pps = await contract.pricePerShare() || ethers.constants.Zero;
			if (isDepositing) {
				const expectedOutFetched = inputAmount.mul(formatBN(10).pow(outputToken?.decimals)).div(pps);
				return toNormalizedBN(expectedOutFetched, outputToken?.decimals || 18);
			}
			const expectedOutFetched = inputAmount.mul(pps).div(formatBN(10).pow(outputToken?.decimals));
			return toNormalizedBN(expectedOutFetched, outputToken?.decimals || 18);
		} catch (error) {
			console.log(error);
			return (toNormalizedBN(0));
		}
	}, [provider, chainID]);

	return retrieveExpectedOut;
}
