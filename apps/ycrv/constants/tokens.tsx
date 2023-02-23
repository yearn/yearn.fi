import Image from 'next/image';
import {VLYCRV_TOKEN_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

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

// TODO Add Image src
export const VL_YCRV = {
	label: 'vl-yCRV',
	symbol: 'vl-yCRV',
	decimals: 18,
	value: VLYCRV_TOKEN_ADDRESS,
	icon: (
		<Image
			alt={'vl-yCRV'}
			width={24}
			height={24}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	)
};
