// We need the following line so that Next.js actually refetch the data a fast
// refresh is done. Cf https://nextjs.org/docs/architecture/fast-refresh#tips
// @refresh reset

import {useMemo} from 'react';
import {erc20ABI, useContractReads} from 'wagmi';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {BAL_TOKEN_ADDRESS, BALWETH_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt} from '@yearn-finance/web-lib/utils/decoder';

import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

const LOCAL_ZAP_YEARN_YBAL_ADDRESS = toAddress('0x43cA9bAe8dF108684E5EAaA720C25e1b32B0A075');

/* 🔵 - Yearn Finance **********************************************************
** This context controls the allowances computation for the yBal app
******************************************************************************/
export function useAllowances(): [TDict<bigint>, () => void] {
	const {address} = useWeb3();
	const wagmiAddress = useMemo((): TAddress => toAddress(address), [address]);
	const zapAddress = useMemo((): TAddress => LOCAL_ZAP_YEARN_YBAL_ADDRESS, []);
	const {data, status, refetch} = useContractReads({
		contracts: [
			{address: BAL_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: WETH_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: BALWETH_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: YBAL_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: STYBAL_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: LPYBAL_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]}
		]
	});

	return useMemo((): [TDict<bigint>, () => void] => {
		if (!data || status !== 'success') {
			return [{}, refetch];
		}
		return [
			{
				[allowanceKey(1, BAL_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(address))]: decodeAsBigInt(data[0]),
				[allowanceKey(1, WETH_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(address))]: decodeAsBigInt(data[1]),
				[allowanceKey(1, BALWETH_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(address))]: decodeAsBigInt(data[2]),
				[allowanceKey(1, YBAL_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(address))]: decodeAsBigInt(data[3]),
				[allowanceKey(1, STYBAL_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(address))]: decodeAsBigInt(data[4]),
				[allowanceKey(1, LPYBAL_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(address))]: decodeAsBigInt(data[5])
			}, refetch
		];
	}, [data, status, address, refetch]);
}

