

import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {BigNumber} from 'ethers';
import type {NextApiRequest, NextApiResponse} from 'next';
import type {TBalanceData} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
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
	let	currentProvider: ethers.providers.JsonRpcProvider;
	if (chainID === 1337) {
		currentProvider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
	} else {
		currentProvider = getProvider(chainID);
	}
	const	ethcallProvider = await newEthCallProvider(currentProvider);
	const	data: TDict<TBalanceData> = {};
	const	chunks = [];
	for (let i = 0; i < tokens.length; i += 5_000) {
		chunks.push(tokens.slice(i, i + 5_000));
	}

	for (const chunkTokens of chunks) {
		const calls = [];
		for (const element of chunkTokens) {
			const	{token} = element;
			const	ownerAddress = address;
			const	isEth = toAddress(token) === ETH_TOKEN_ADDRESS;
			if (isEth) {
				const	tokenContract = new Contract(WETH_TOKEN_ADDRESS, ERC20_ABI);
				calls.push(
					ethcallProvider.getEthBalance(ownerAddress),
					tokenContract.decimals(),
					tokenContract.symbol()
				);
			} else {
				const	tokenContract = new Contract(token, ERC20_ABI);
				calls.push(
					tokenContract.balanceOf(ownerAddress),
					tokenContract.decimals(),
					tokenContract.symbol()
				);
			}
		}

		try {
			const	results = await ethcallProvider.tryAll(calls);

			let		rIndex = 0;
			for (const element of chunkTokens) {
				const	{token} = element;
				const	balanceOf = results[rIndex++] as BigNumber;
				const	decimals = results[rIndex++] as number;
				let symbol = results[rIndex++] as string;

				if (toAddress(token) === ETH_TOKEN_ADDRESS) {
					symbol = 'ETH';
				}
				data[toAddress(token)] = {
					decimals: Number(decimals),
					symbol: symbol,
					raw: balanceOf,
					rawPrice: formatBN(0),
					normalized: formatToNormalizedValue(balanceOf, Number(decimals)),
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

export type TGetBatchBalancesResp = {balances: TDict<TBalanceData>, chainID: number};
export default async function handler(req: NextApiRequest, res: NextApiResponse<TGetBatchBalancesResp>): Promise<void> {
	const	balances = await getBatchBalances({
		chainID: Number(req.body.chainID),
		address: req.body.address as string,
		tokens: req.body.tokens as unknown as TUseBalancesTokens[]
	});
	return res.status(200).json({balances, chainID: req.body.chainID});
}
