import React from 'react';
import Image from 'next/image';
import {toAddress} from '@yearn-finance/web-lib/utils';

import type {TDropdownOption} from 'types/types';

const	LEGACY_OPTIONS_FROM: TDropdownOption[] = [
	{
		label: 'yvBOOST',
		symbol: 'yvBOOST',
		value: toAddress(process.env.YVBOOST_TOKEN_ADDRESS),
		zapVia: toAddress(process.env.ZAP_YEARN_VE_CRV_ADDRESS),
		icon: (
			<Image
				alt={'yvBOOST'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.YVBOOST_TOKEN_ADDRESS)}/logo-128.png`} />
		)
	}, {
		label: 'yveCRV',
		symbol: 'yveCRV',
		value: toAddress(process.env.YVECRV_TOKEN_ADDRESS),
		zapVia: toAddress(process.env.ZAP_YEARN_VE_CRV_ADDRESS),
		icon: (
			<Image
				alt={'yveCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.YVECRV_TOKEN_ADDRESS)}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	}
];

const	LEGACY_OPTIONS_TO: TDropdownOption[] = [
	{
		label: 'st-yCRV',
		symbol: 'st-yCRV',
		value: toAddress(process.env.STYCRV_TOKEN_ADDRESS),
		zapVia: toAddress(process.env.ZAP_YEARN_VE_CRV_ADDRESS),
		icon: (
			<Image
				alt={'st-yCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.STYCRV_TOKEN_ADDRESS)}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	}, {
		label: 'yCRV',
		symbol: 'yCRV',
		value: toAddress(process.env.YCRV_TOKEN_ADDRESS),
		zapVia: toAddress(process.env.ZAP_YEARN_VE_CRV_ADDRESS),
		icon: (
			<Image
				alt={'yCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.YCRV_TOKEN_ADDRESS)}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	},
	{
		label: 'lp-yCRV',
		symbol: 'lp-yCRV',
		value: toAddress(process.env.LPYCRV_TOKEN_ADDRESS),
		zapVia: toAddress(process.env.ZAP_YEARN_VE_CRV_ADDRESS),
		icon: (
			<Image
				alt={'lp-yCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.LPYCRV_TOKEN_ADDRESS)}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	} 
// {
// 	label: 'vl-yCRV',
// 	value: toAddress(process.env.VLYCRV_TOKEN_ADDRESS),
// 	icon: (
// 		<Image
// 			alt={'vl-yCRV'}
// 			width={24}
// 			height={24}
// 			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.VLYCRV_TOKEN_ADDRESS)}/logo-128.png`}
// 			loading={'eager'}
// 			priority />
// 	)
// }
];

const	ZAP_OPTIONS_FROM: TDropdownOption[] = [
	{
		label: 'CRV',
		symbol: 'CRV',
		value: toAddress(process.env.CRV_TOKEN_ADDRESS),
		zapVia: toAddress(process.env.ZAP_YEARN_VE_CRV_ADDRESS),
		icon: (
			<Image
				alt={'CRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.CRV_TOKEN_ADDRESS)}/logo-128.png`} />
		)
	},
	...LEGACY_OPTIONS_TO,
	{
		label: 'Curve CRV/yCRV',
		symbol: 'CRV/yCRV',
		value: toAddress(process.env.YCRV_CURVE_POOL_ADDRESS),
		zapVia: toAddress(process.env.LPYCRV_TOKEN_ADDRESS),
		icon: (
			<Image
				alt={'Curve CRV/yCRV'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.YCRV_CURVE_POOL_ADDRESS)}/logo-128.png`} />
		)
	},
	...LEGACY_OPTIONS_FROM
];

const	ZAP_OPTIONS_TO: TDropdownOption[] = [...LEGACY_OPTIONS_TO];


export {
	LEGACY_OPTIONS_FROM, LEGACY_OPTIONS_TO, ZAP_OPTIONS_FROM, ZAP_OPTIONS_TO
};
