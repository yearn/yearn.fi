import React from 'react';
import Image from 'next/image';
import {BAL_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, Y8020BAL_TOKE_ADDRESS, YBAL_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

export const BAL = {
	label: 'Bal',
	symbol: 'Bal',
	decimals: 18,
	value: BAL_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
	icon: (
		<Image
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
	zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
	icon: (
		<Image
			alt={'yBal'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YBAL_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};
export const Y8020BAL = {
	label: '80:20 / yBAL Factory Pool',
	symbol: 'B-yBAL-STABLE',
	decimals: 18,
	value: Y8020BAL_TOKE_ADDRESS,
	zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'B-yBAL-STABLE'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${Y8020BAL_TOKE_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};
export const STYBAL = {
	label: 'st-yBal',
	symbol: 'st-yBal',
	decimals: 18,
	value: STYBAL_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
	icon: (
		<Image
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
	zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
	icon: (
		<Image
			alt={'lp-yBal'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${LPYBAL_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};
