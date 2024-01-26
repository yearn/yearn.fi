// We need the following line so that Next.js actually refetch the data a fast
// refresh is done. Cf https://nextjs.org/docs/architecture/fast-refresh#tips
// @refresh reset

import {useMemo} from 'react';
import {erc20ABI, useContractReads} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {decodeAsBigInt, toAddress} from '@builtbymom/web3/utils';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {
	CRV_TOKEN_ADDRESS,
	CVXCRV_TOKEN_ADDRESS,
	LPYCRV_TOKEN_ADDRESS,
	LPYCRV_V2_TOKEN_ADDRESS,
	STYCRV_TOKEN_ADDRESS,
	YCRV_CURVE_POOL_ADDRESS,
	YCRV_CURVE_POOL_V2_ADDRESS,
	YCRV_TOKEN_ADDRESS,
	YVBOOST_TOKEN_ADDRESS,
	YVECRV_POOL_LP_ADDRESS,
	YVECRV_TOKEN_ADDRESS,
	ZAP_YEARN_VE_CRV_ADDRESS
} from '@yearn-finance/web-lib/utils/constants';

import type {TAddress, TDict} from '@builtbymom/web3/types';

/* 🔵 - Yearn Finance **********************************************************
 ** This context controls the allowances computation for the yCRV app
 ******************************************************************************/
export function useAllowances(): [TDict<bigint>, () => void] {
	const {address} = useWeb3();
	const wagmiAddress = useMemo((): TAddress => toAddress(address), [address]);
	const {data, status, refetch} = useContractReads({
		contracts: [
			{
				address: YCRV_TOKEN_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, ZAP_YEARN_VE_CRV_ADDRESS]
			},
			{
				address: STYCRV_TOKEN_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, ZAP_YEARN_VE_CRV_ADDRESS]
			},
			{
				address: LPYCRV_TOKEN_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, ZAP_YEARN_VE_CRV_ADDRESS]
			},
			{
				address: YVECRV_TOKEN_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, ZAP_YEARN_VE_CRV_ADDRESS]
			},
			{
				address: CRV_TOKEN_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, ZAP_YEARN_VE_CRV_ADDRESS]
			},
			{
				address: YVBOOST_TOKEN_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, ZAP_YEARN_VE_CRV_ADDRESS]
			},
			{
				address: YCRV_CURVE_POOL_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, ZAP_YEARN_VE_CRV_ADDRESS]
			},
			{
				address: CVXCRV_TOKEN_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, ZAP_YEARN_VE_CRV_ADDRESS]
			},
			{
				address: YCRV_CURVE_POOL_V2_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, ZAP_YEARN_VE_CRV_ADDRESS]
			},
			{
				address: YVECRV_TOKEN_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, YVECRV_POOL_LP_ADDRESS]
			},
			{
				address: CRV_TOKEN_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, YVECRV_POOL_LP_ADDRESS]
			},
			{
				address: YCRV_CURVE_POOL_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, LPYCRV_TOKEN_ADDRESS]
			},
			{
				address: YCRV_CURVE_POOL_V2_ADDRESS,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [wagmiAddress, LPYCRV_V2_TOKEN_ADDRESS]
			}
		]
	});

	return useMemo((): [TDict<bigint>, () => void] => {
		if (!data || status !== 'success') {
			return [{}, refetch];
		}
		return [
			{
				[allowanceKey(1, YCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[0]
				),
				[allowanceKey(1, STYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[1]
				),
				[allowanceKey(1, LPYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[2]
				),
				[allowanceKey(1, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[3]
				),
				[allowanceKey(1, CRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[4]
				),
				[allowanceKey(1, YVBOOST_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[5]
				),
				[allowanceKey(1, YCRV_CURVE_POOL_ADDRESS, LPYCRV_TOKEN_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[6]
				),
				[allowanceKey(1, CVXCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[7]
				),
				[allowanceKey(1, YCRV_CURVE_POOL_V2_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]:
					decodeAsBigInt(data[8]),
				[allowanceKey(1, YVECRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[9]
				),
				[allowanceKey(1, CRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[10]
				),
				[allowanceKey(1, YCRV_CURVE_POOL_ADDRESS, LPYCRV_TOKEN_ADDRESS, toAddress(address))]: decodeAsBigInt(
					data[11]
				),
				[allowanceKey(1, YCRV_CURVE_POOL_V2_ADDRESS, LPYCRV_V2_TOKEN_ADDRESS, toAddress(address))]:
					decodeAsBigInt(data[12])
			},
			refetch
		];
	}, [data, status, address, refetch]);
}
