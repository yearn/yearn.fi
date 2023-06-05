import Image from 'next/image';
import {CRV_TOKEN_ADDRESS, CVXCRV_TOKEN_ADDRESS, LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {TDropdownOption} from '@common/types/types';

export const YVBOOST = {
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
};

export const YVECRV = {
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
};

export const STYCRV = {
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
};

export const YCRV = {
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
};

export const LPYCRV = {
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
};

export const CRV = {
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
};

export const CVXCRV = {
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
};

export const CRVYCRV = {
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
};

export const LEGACY_OPTIONS_FROM: TDropdownOption[] = [YVBOOST, YVECRV];
export const LEGACY_OPTIONS_TO: TDropdownOption[] = [STYCRV, YCRV, LPYCRV];
export const ZAP_OPTIONS_FROM: TDropdownOption[] = [
	CRV,
	...LEGACY_OPTIONS_TO,
	CVXCRV,
	CRVYCRV,
	...LEGACY_OPTIONS_FROM
];
export const ZAP_OPTIONS_TO: TDropdownOption[] = [...LEGACY_OPTIONS_TO];
