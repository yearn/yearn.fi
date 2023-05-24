import React from 'react';
import {BAL_TOKEN_ADDRESS, BALWETH_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

export const BAL = {
	label: 'Bal',
	symbol: 'Bal',
	decimals: 18,
	value: BAL_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_YBAL_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'Bal'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${BAL_TOKEN_ADDRESS}/logo-128.png`} />
	)
};
export const YBAL = {
	label: 'yBal',
	symbol: 'yBal',
	decimals: 18,
	value: YBAL_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_YBAL_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'yBal'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YBAL_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};
export const BALWETH = {
	label: 'BAL/wETH',
	symbol: 'BAL/wETH',
	decimals: 18,
	value: BALWETH_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_YBAL_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'BAL/wETH'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${BALWETH_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};
export const STYBAL = {
	label: 'st-yBal',
	symbol: 'st-yBal',
	decimals: 18,
	value: STYBAL_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_YBAL_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'st-yBal'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${STYBAL_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};
export const LPYBAL = {
	label: 'lp-yBal',
	symbol: 'lp-yBal',
	decimals: 18,
	value: LPYBAL_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_YBAL_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'lp-yBal'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${LPYBAL_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};
export const WETH = {
	label: 'wETH',
	symbol: 'wETH',
	decimals: 18,
	value: WETH_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_YBAL_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'wETH'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${WETH_TOKEN_ADDRESS}/logo-128.png`} />
	)
};
