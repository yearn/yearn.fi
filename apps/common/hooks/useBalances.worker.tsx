

import {Contract} from 'ethcall';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {BigNumber} from 'ethers';
import type {TBalanceData} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TUseBalancesTokens} from './useBalances';

type TPerformCall = {
	chainID: number,
	address: string,
	tokens: TUseBalancesTokens[],
}
async function performCall({
	chainID,
	address,
	tokens
}: TPerformCall): Promise<[number, TDict<TBalanceData>, Error | undefined]> {
	const	currentProvider = getProvider(chainID);
	const	ethcallProvider = await newEthCallProvider(currentProvider);

	const	calls = [];
	for (const element of tokens) {
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

	const	_data: TDict<TBalanceData> = {};
	try {
		const	results = await ethcallProvider.tryAll(calls);

		let		rIndex = 0;
		for (const element of tokens) {
			const	{token} = element;
			const	balanceOf = results[rIndex++] as BigNumber;
			const	decimals = results[rIndex++] as number;
			let symbol = results[rIndex++] as string;

			if (toAddress(token) === ETH_TOKEN_ADDRESS) {
				symbol = 'ETH';
			}
			_data[toAddress(token)] = {
				decimals: Number(decimals),
				symbol: symbol,
				raw: balanceOf,
				rawPrice: formatBN(0),
				normalized: formatToNormalizedValue(balanceOf, Number(decimals)),
				normalizedPrice: 0,
				normalizedValue: 0
			};
		}
		return [chainID, _data, undefined];
	} catch (error) {
		return [chainID, _data, error as Error];
	}
}

addEventListener('message', (event: MessageEvent<TPerformCall>): void => {
	performCall(event.data).then((res): void => postMessage(res));
});
