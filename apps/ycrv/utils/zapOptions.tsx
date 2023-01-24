import React from 'react';
import Image from 'next/image';
import {CRV_TOKEN_ADDRESS, CVXCRV_TOKEN_ADDRESS, LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {TDropdownOption} from '@common/types/types';

const	LEGACY_OPTIONS_FROM: TDropdownOption[] = [
	{
		label: 'yvBOOST',
		symbol: 'yvBOOST',
		decimals: 18,
		value: YVBOOST_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
		icon: (
			<Image
				alt={'yvBOOST'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YVBOOST_TOKEN_ADDRESS}/logo-128.png`} />
		)
	}, {
		label: 'yveCRV',
		symbol: 'yveCRV',
		decimals: 18,
		value: YVECRV_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
		icon: (
			<Image
				alt={'yveCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YVECRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	}
];

const	LEGACY_OPTIONS_TO: TDropdownOption[] = [
	{
		label: 'st-yCRV',
		symbol: 'st-yCRV',
		decimals: 18,
		value: STYCRV_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
		icon: (
			<Image
				alt={'st-yCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${STYCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	}, {
		label: 'yCRV',
		symbol: 'yCRV',
		decimals: 18,
		value: YCRV_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
		icon: (
			<Image
				alt={'yCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	},
	{
		label: 'lp-yCRV',
		symbol: 'lp-yCRV',
		decimals: 18,
		value: LPYCRV_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
		icon: (
			<Image
				alt={'lp-yCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${LPYCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	}
// {
// 	label: 'vl-yCRV',
// 	value: VLYCRV_TOKEN_ADDRESS,
// 	icon: (
// 		<Image
// 			alt={'vl-yCRV'}
// 			width={24}
// 			height={24}
// 			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${VLYCRV_TOKEN_ADDRESS}/logo-128.png`}
// 			loading={'eager'}
// 			priority />
// 	)
// }
];

const	ZAP_OPTIONS_FROM: TDropdownOption[] = [
	{
		label: 'CRV',
		symbol: 'CRV',
		decimals: 18,
		value: CRV_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
		icon: (
			<Image
				alt={'CRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${CRV_TOKEN_ADDRESS}/logo-128.png`} />
		)
	},
	...LEGACY_OPTIONS_TO,
	{
		label: 'cvxCRV',
		symbol: 'cvxCRV',
		decimals: 18,
		value: CVXCRV_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
		icon: (
			<Image
				alt={'cvxCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${CVXCRV_TOKEN_ADDRESS}/logo-128.png`} />
		)
	},
	{
		label: 'Curve CRV/yCRV',
		symbol: 'CRV/yCRV',
		decimals: 18,
		value: YCRV_CURVE_POOL_ADDRESS,
		zapVia: LPYCRV_TOKEN_ADDRESS,
		icon: (
			<Image
				alt={'Curve CRV/yCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_CURVE_POOL_ADDRESS}/logo-128.png`} />
		)
	},
	...LEGACY_OPTIONS_FROM
];

const	ZAP_OPTIONS_TO: TDropdownOption[] = [...LEGACY_OPTIONS_TO];

export {
	LEGACY_OPTIONS_FROM,
	LEGACY_OPTIONS_TO,
	ZAP_OPTIONS_FROM,
	ZAP_OPTIONS_TO
};
