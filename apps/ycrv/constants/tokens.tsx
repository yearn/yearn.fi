import {CRV_TOKEN_ADDRESS, CVXCRV_TOKEN_ADDRESS, LPYCRV_TOKEN_ADDRESS, LPYCRV_V2_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_CURVE_POOL_V2_ADDRESS, YCRV_TOKEN_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {TDropdownOption} from '@common/types/types';

export const YVBOOST = {
	label: 'yvBOOST',
	symbol: 'yvBOOST',
	decimals: 18,
	value: YVBOOST_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
	icon: (
		<ImageWithFallback
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
		<ImageWithFallback
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
		<ImageWithFallback
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
		<ImageWithFallback
			alt={'yCRV'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};

export const LPYCRV = {
	label: 'lp-yCRV (deprecated)',
	symbol: 'lp-yCRV (deprecated)',
	decimals: 18,
	value: LPYCRV_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'lp-yCRV (deprecated)'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${LPYCRV_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};

export const LPYCRV2 = {
	label: 'lp-yCRV V2',
	symbol: 'lp-yCRV V2',
	decimals: 18,
	value: LPYCRV_V2_TOKEN_ADDRESS,
	zapVia: ZAP_YEARN_VE_CRV_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'lp-yCRV V2'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${LPYCRV_V2_TOKEN_ADDRESS}/logo-128.png`}
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
		<ImageWithFallback
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
		<ImageWithFallback
			alt={'cvxCRV'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${CVXCRV_TOKEN_ADDRESS}/logo-128.png`} />
	)
};

export const CRVYCRV = {
	label: 'Curve CRV/yCRV (deprecated)',
	symbol: 'CRV/yCRV (deprecated)',
	decimals: 18,
	value: YCRV_CURVE_POOL_ADDRESS,
	zapVia: LPYCRV_TOKEN_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'Curve CRV/yCRV (deprecated)'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_CURVE_POOL_ADDRESS}/logo-128.png`} />
	)
};

export const CRVYCRV2 = {
	label: 'Curve CRV/yCRV V2',
	symbol: 'CRV/yCRV V2',
	decimals: 18,
	value: YCRV_CURVE_POOL_V2_ADDRESS,
	zapVia: LPYCRV_V2_TOKEN_ADDRESS,
	icon: (
		<ImageWithFallback
			alt={'Curve CRV/yCRV V2'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_CURVE_POOL_V2_ADDRESS}/logo-128.png`} />
	)
};

export const ZAP_OPTIONS_FROM: TDropdownOption[] = [CRV, STYCRV, YCRV, LPYCRV, LPYCRV2, CVXCRV, CRVYCRV, CRVYCRV2, YVBOOST, YVECRV];
export const ZAP_OPTIONS_TO: TDropdownOption[] = [STYCRV, YCRV, LPYCRV2];
