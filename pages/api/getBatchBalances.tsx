import {serialize} from 'wagmi';
import {captureException} from '@sentry/nextjs';
import {getNativeTokenWrapperContract, getNativeTokenWrapperName} from '@vaults/utils';
import {erc20ABI, multicall} from '@wagmi/core';
import AGGREGATE3_ABI from '@yearn-finance/web-lib/utils/abi/aggregate.abi';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, MULTICALL3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt, decodeAsNumber, decodeAsString} from '@yearn-finance/web-lib/utils/decoder';
import {toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getRPC} from '@yearn-finance/web-lib/utils/web3/providers';

import type {NextApiRequest, NextApiResponse} from 'next';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TBalanceData} from '@yearn-finance/web-lib/types/hooks';
import type {TUseBalancesTokens} from '@common/hooks/useBalances';

type TPerformCall = {
	chainID: number,
	address: string,
	tokens: TUseBalancesTokens[]
}
async function getBatchBalances({
	chainID,
	address,
	tokens
}: TPerformCall): Promise<TDict<TBalanceData>> {
	const data: TDict<TBalanceData> = {};
	const chunks = [];
	for (let i = 0; i < tokens.length; i += 5_000) {
		chunks.push(tokens.slice(i, i + 5_000));
	}

	const nativeTokenWrapper = getNativeTokenWrapperContract(chainID);
	const nativeTokenWrapperName = getNativeTokenWrapperName(chainID);
	for (const chunkTokens of chunks) {
		const calls = [];
		for (const element of chunkTokens) {
			const {token} = element;
			const ownerAddress = address;
			const isEth = toAddress(token) === toAddress(ETH_TOKEN_ADDRESS);
			if (isEth) {
				const multicall3Contract = {address: MULTICALL3_ADDRESS, abi: AGGREGATE3_ABI};
				const baseContract = {address: nativeTokenWrapper, abi: erc20ABI};
				calls.push({...multicall3Contract, functionName: 'getEthBalance', args: [ownerAddress]});
				calls.push({...baseContract, functionName: 'decimals'});
				calls.push({...baseContract, functionName: 'symbol'});
			} else {
				const baseContract = {address: toAddress(token), abi: erc20ABI};
				calls.push({...baseContract, functionName: 'balanceOf', args: [ownerAddress]});
				calls.push({...baseContract, functionName: 'decimals'});
				calls.push({...baseContract, functionName: 'symbol'});
			}
		}

		try {
			const results = await multicall({contracts: calls as never[], chainId: chainID});

			let rIndex = 0;
			for (const element of tokens) {
				const {token} = element;
				const balanceOf = decodeAsBigInt(results[rIndex++]);
				const decimals = decodeAsNumber(results[rIndex++]);
				const symbol = decodeAsString(results[rIndex++]);
				data[toAddress(token)] = {
					decimals: decimals || 18,
					symbol: toAddress(token) === ETH_TOKEN_ADDRESS ? nativeTokenWrapperName : symbol,
					raw: balanceOf,
					rawPrice: 0n,
					normalized: toNormalizedValue(balanceOf, decimals || 18),
					normalizedPrice: 0,
					normalizedValue: 0
				};
			}
		} catch (error) {
			continue;
		}
	}

	return data;
}

export function isArrayOfUseBalancesTokens(value: unknown): value is TUseBalancesTokens[] {
	return Array.isArray(value) && value.every(({token}): boolean => !!token && typeof token === 'string');
}

export type TGetBatchBalancesResp = {balances: string, chainID: number};
export default async function handler(req: NextApiRequest, res: NextApiResponse<TGetBatchBalancesResp>): Promise<void> {
	const chainID = Number(req.body.chainID);
	const address = String(req.body.address);
	const tokens = isArrayOfUseBalancesTokens(req.body.tokens) ? req.body.tokens : [];

	try {
		const balances = await getBatchBalances({chainID, address, tokens});
		return res.status(200).json({balances: serialize(balances), chainID: req.body.chainID});
	} catch (error) {
		captureException(error, {tags: {rpc: getRPC(chainID), chainID, address}});
	}
}
