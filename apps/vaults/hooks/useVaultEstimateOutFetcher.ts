import {useCallback} from 'react';
import {readContract} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import VAULT_ABI from '@yearn-finance/web-lib/utils/abi/vault.abi';
import {isZeroAddress, toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

export type TVaultEstimateOutFetcher = [
    inputToken: TDropdownOption,
    outputToken: TDropdownOption,
	inputAmount: bigint,
	isDepositing: boolean
]

export function	useVaultEstimateOutFetcher(): (args: TVaultEstimateOutFetcher) => Promise<TNormalizedBN> {
	const {chainID} = useWeb3();

	const retrieveExpectedOut = useCallback(async (args: TVaultEstimateOutFetcher): Promise<TNormalizedBN> => {
		const [inputToken, outputToken, inputAmount, isDepositing] = args;
		if (isZeroAddress(inputToken?.value) || isZeroAddress(outputToken?.value) || inputAmount === 0n) {
			return (toNormalizedBN(0));
		}

		try {
			const decimals = toBigInt(outputToken?.decimals || 18);
			const powerDecimals = toBigInt(10) ** decimals;
			const contractAddress = toWagmiAddress(isDepositing ? outputToken.value : inputToken.value);
			const pps = await readContract({
				abi: VAULT_ABI,
				address: contractAddress,
				functionName: 'pricePerShare',
				chainId: chainID
			});

			if (isDepositing) {
				const expectedOutFetched = inputAmount * powerDecimals / pps;
				return toNormalizedBN(expectedOutFetched, outputToken?.decimals || 18);
			}
			const expectedOutFetched = inputAmount * pps / powerDecimals;
			return toNormalizedBN(expectedOutFetched, outputToken?.decimals || 18);
		} catch (error) {
			console.error(error);
			return (toNormalizedBN(0));
		}
	}, [chainID]);

	return retrieveExpectedOut;
}
