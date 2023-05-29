import {captureException} from '@sentry/nextjs';
import {erc20ABI, prepareWriteContract, readContract, waitForTransaction, writeContract} from '@wagmi/core';
import {toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {MaxUint256} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {toWagmiProvider} from '@common/utils/toWagmiProvider';

import type {BaseError} from 'viem';
import type {Connector} from 'wagmi';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	isApprovedERC20(
	connector: Connector,
	tokenAddress: TAddress,
	spender: TAddress,
	amount = MaxUint256
): Promise<boolean> {
	const wagmiProvider = await toWagmiProvider(connector);
	const result = await readContract({
		...wagmiProvider,
		abi: erc20ABI,
		address: toWagmiAddress(tokenAddress),
		functionName: 'allowance',
		args: [toWagmiAddress(wagmiProvider.address), toWagmiAddress(spender)]
	});
	return (result || 0n) >= amount;
}

export async function	approvedERC20Amount(
	connector: Connector,
	tokenAddress: TAddress,
	spender: TAddress
): Promise<bigint> {
	const wagmiProvider = await toWagmiProvider(connector);
	const result = await readContract({
		...wagmiProvider,
		abi: erc20ABI,
		address: toWagmiAddress(tokenAddress),
		functionName: 'allowance',
		args: [toWagmiAddress(wagmiProvider.address), toWagmiAddress(spender)]
	});
	return result || 0n;
}

export async function	approveERC20(
	connector: Connector,
	tokenAddress: string,
	spender: string,
	amount = MaxUint256
): Promise<TTxResponse> {
	try {
		const wagmiProvider = await toWagmiProvider(connector);
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(tokenAddress),
			abi: erc20ABI,
			functionName: 'approve',
			args: [toWagmiAddress(spender), amount]
		});
		const {hash} = await writeContract(config.request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		captureException(errorAsBaseError);
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	}
}
