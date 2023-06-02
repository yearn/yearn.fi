import {readContract} from '@wagmi/core';
import VAULT_ABI from '@yearn-finance/web-lib/utils/abi/vault.abi';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {assert} from '@common/utils/assert';
import {assertAddress} from '@common/utils/toWagmiProvider';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@common/types/types';

type TGetVaultEstimateOutProps = {
	inputToken: TAddress
	outputToken: TAddress
	inputDecimals: number
	outputDecimals: number
	inputAmount: bigint
	isDepositing: boolean
	chainID: number;
}
async function getVaultEstimateOut(props: TGetVaultEstimateOutProps): Promise<TNormalizedBN> {
	assertAddress(props.inputToken, 'inputToken');
	assertAddress(props.outputToken, 'outputToken');
	assert(props.inputDecimals > 0, 'inputDecimals must be greater than 0');
	assert(props.outputDecimals > 0, 'outputDecimals must be greater than 0');

	if (props.inputAmount <= 0n) {
		return toNormalizedBN(0);
	}

	const inputDecimals = toBigInt(props.inputDecimals || 18);
	const powerDecimals = toBigInt(10) ** inputDecimals;
	const contractAddress = props.isDepositing ? props.outputToken : props.inputToken;
	const pps = await readContract({
		abi: VAULT_ABI,
		address: contractAddress,
		functionName: 'pricePerShare',
		chainId: props.chainID
	});
	if (props.isDepositing) {
		const expectedOutFetched = props.inputAmount * powerDecimals / pps;
		return toNormalizedBN(expectedOutFetched, Number(inputDecimals));
	}
	const outputDecimals = toBigInt(props.outputDecimals || 18);
	const expectedOutFetched = props.inputAmount * pps / powerDecimals;
	return toNormalizedBN(expectedOutFetched, Number(outputDecimals));
}

export default getVaultEstimateOut;
