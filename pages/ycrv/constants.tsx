import Image from 'next/image';
import {STYCRV_TOKEN_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

export const YCRV = {
	label: 'yCRV',
	symbol: 'yCRV',
	decimals: 18,
	value: YCRV_TOKEN_ADDRESS,
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

export const ST_YCRV = {
	label: 'st-yCRV',
	symbol: 'st-yCRV',
	decimals: 18,
	value: STYCRV_TOKEN_ADDRESS,
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
