import {assert, assertAddress, toBigInt, toNormalizedBN} from 'builtbymom-web3-fork/utils';
import {retrieveConfig} from 'builtbymom-web3-fork/utils/wagmi';
import {readContract} from '@wagmi/core';
import {VAULT_ABI} from '@yearn-finance/web-lib/utils/abi/vault.abi';

import {VAULT_V3_ABI} from './abi/vaultV3.abi';

import type {TAddress, TNormalizedBN} from 'builtbymom-web3-fork/types';

type TGetVaultEstimateOutProps = {
	from: TAddress;
	inputToken: TAddress;
	outputToken: TAddress;
	inputDecimals: number;
	outputDecimals: number;
	inputAmount: bigint;
	maxLoss?: bigint;
	isDepositing: boolean;
	chainID: number;
	version: string;
};

/**************************************************************************************************
 ** getVaultEstimateOut will return the expected output amount for the provided input amount. This
 ** will be used to show the user the expected amount they will receive after the deposit or
 ** withdrawal.
 ** This method is using the plain pricePerShare method to get the expected output amount. With V3
 ** vaults other methods could be used.
 ** This method takes the input amount without verifications, meaning that it will not check if
 ** the user has enough balance to perform the action.
 *************************************************************************************************/
export async function getVaultEstimateOut(props: TGetVaultEstimateOutProps): Promise<TNormalizedBN | undefined> {
	assertAddress(props.inputToken, 'inputToken');
	assertAddress(props.outputToken, 'outputToken');
	assert(props.inputDecimals > 0, 'inputDecimals must be greater than 0');
	assert(props.outputDecimals > 0, 'outputDecimals must be greater than 0');

	if (props.inputAmount <= 0n) {
		return undefined;
	}

	const inputDecimals = toBigInt(props.inputDecimals || 18);
	const powerDecimals = toBigInt(10) ** inputDecimals;
	const contractAddress = props.isDepositing ? props.outputToken : props.inputToken;

	try {
		const pps = await readContract(retrieveConfig(), {
			abi: VAULT_ABI,
			address: contractAddress,
			functionName: 'pricePerShare',
			chainId: props.chainID
		});

		if (props.isDepositing) {
			const expectedOutFetched = (props.inputAmount * powerDecimals) / pps;
			return toNormalizedBN(expectedOutFetched, Number(inputDecimals));
		}
		const outputDecimals = toBigInt(props.outputDecimals || 18);
		const expectedOutFetched = (props.inputAmount * pps) / powerDecimals;
		return toNormalizedBN(expectedOutFetched, Number(outputDecimals));
	} catch (error) {
		if (props.isDepositing) {
			const convertedShares = await readContract(retrieveConfig(), {
				abi: VAULT_V3_ABI,
				address: contractAddress,
				functionName: 'convertToShares',
				chainId: props.chainID,
				args: [props.inputAmount]
			});
			return toNormalizedBN(convertedShares, Number(inputDecimals));
		}
		const convertedAssets = await readContract(retrieveConfig(), {
			abi: VAULT_V3_ABI,
			address: contractAddress,
			functionName: 'convertToAssets',
			chainId: props.chainID,
			args: [props.inputAmount]
		});
		const outputDecimals = toBigInt(props.outputDecimals || 18);
		return toNormalizedBN(convertedAssets, Number(outputDecimals));
	}
}
