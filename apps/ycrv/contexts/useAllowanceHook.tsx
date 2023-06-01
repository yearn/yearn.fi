// We need the following line so that Next.js actually refetch the data a fast
// refresh is done. Cf https://nextjs.org/docs/architecture/fast-refresh#tips
// @refresh reset

import {useMemo} from 'react';
import {erc20ABI, useContractReads} from 'wagmi';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {CRV_TOKEN_ADDRESS, CVXCRV_TOKEN_ADDRESS, LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt} from '@yearn-finance/web-lib/utils/decoder';

import type {TAddressWagmi, TDict} from '@yearn-finance/web-lib/types';

/* 🔵 - Yearn Finance **********************************************************
** This context controls the allowances computation for the yCRV app
******************************************************************************/
export function useAllowances(): TDict<bigint> {
	const {address} = useWeb3();
	const wagmiAddress = useMemo((): TAddressWagmi => toAddress(address), [address]);
	const zapAddress = useMemo((): TAddressWagmi => ZAP_YEARN_VE_CRV_ADDRESS, []);
	const poolAddress = useMemo((): TAddressWagmi => YVECRV_POOL_LP_ADDRESS, []);
	const lpyCRVAddress = useMemo((): TAddressWagmi => LPYCRV_TOKEN_ADDRESS, []);
	const {data, status} = useContractReads({
		contracts: [
			{address: YCRV_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: STYCRV_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: LPYCRV_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: YVECRV_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: CRV_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: YVBOOST_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: YCRV_CURVE_POOL_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: CVXCRV_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, zapAddress]},
			{address: YVECRV_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, poolAddress]},
			{address: CRV_TOKEN_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, poolAddress]},
			{address: YCRV_CURVE_POOL_ADDRESS, abi: erc20ABI, functionName: 'allowance', args: [wagmiAddress, lpyCRVAddress]}
		]
	});

	return useMemo((): TDict<bigint> => {
		if (!data || status !== 'success') {
			return {};
		}
		return {
			[allowanceKey(1, YCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(data[0]),
			[allowanceKey(1, STYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(data[1]),
			[allowanceKey(1, LPYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(data[2]),
			[allowanceKey(1, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(data[3]),
			[allowanceKey(1, CRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]:  decodeAsBigInt(data[4]),
			[allowanceKey(1, YVBOOST_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(data[5]),
			[allowanceKey(1, YCRV_CURVE_POOL_ADDRESS, LPYCRV_TOKEN_ADDRESS, toAddress(address))]: decodeAsBigInt(data[6]),
			[allowanceKey(1, CVXCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(address))]: decodeAsBigInt(data[7]),
			[allowanceKey(1, YVECRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, toAddress(address))]: decodeAsBigInt(data[8]),
			[allowanceKey(1, CRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, toAddress(address))]: decodeAsBigInt(data[9]),
			[allowanceKey(1, YCRV_CURVE_POOL_ADDRESS, LPYCRV_TOKEN_ADDRESS, toAddress(address))]: decodeAsBigInt(data[10])
		};
	}, [data, status, address]);
}

