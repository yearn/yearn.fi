import Image from 'next/image';
import {BAL_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {TDropdownOption} from '@common/types/types';

const ZAP_OPTIONS_FROM: TDropdownOption[] = [
	{
		label: 'Bal',
		symbol: 'Bal',
		decimals: 18,
		value: BAL_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_YBAL_ADDRESS,
		icon: (
			<Image
				alt={'Bal'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${BAL_TOKEN_ADDRESS}/logo-128.png`} />
		)
	},
	{
		label: 'st-yBal',
		symbol: 'st-yBal',
		decimals: 18,
		value: STYBAL_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_YBAL_ADDRESS,
		icon: (
			<Image
				alt={'st-yBal'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${STYBAL_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	}, {
		label: 'yBal',
		symbol: 'yBal',
		decimals: 18,
		value: YBAL_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_YBAL_ADDRESS,
		icon: (
			<Image
				alt={'yBal'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YBAL_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	},
	{
		label: 'lp-yBal',
		symbol: 'lp-yBal',
		decimals: 18,
		value: LPYBAL_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_YBAL_ADDRESS,
		icon: (
			<Image
				alt={'lp-yBal'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${LPYBAL_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	}
];

const ZAP_OPTIONS_TO: TDropdownOption[] = [
	{
		label: 'st-yBal',
		symbol: 'st-yBal',
		decimals: 18,
		value: STYBAL_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_YBAL_ADDRESS,
		icon: (
			<Image
				alt={'st-yBal'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${STYBAL_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	}, {
		label: 'yBal',
		symbol: 'yBal',
		decimals: 18,
		value: YBAL_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_YBAL_ADDRESS,
		icon: (
			<Image
				alt={'yBal'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YBAL_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	},
	{
		label: 'lp-yBal',
		symbol: 'lp-yBal',
		decimals: 18,
		value: LPYBAL_TOKEN_ADDRESS,
		zapVia: ZAP_YEARN_YBAL_ADDRESS,
		icon: (
			<Image
				alt={'lp-yBal'}
				width={24}
				height={24}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${LPYBAL_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	}
];

export {
	ZAP_OPTIONS_FROM,
	ZAP_OPTIONS_TO
};
