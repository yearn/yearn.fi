import Image from 'next/image';
import {YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

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

// TODO Move to web-lib
const VL_YCRV_TOKEN_ADDRESS = '0xCCBD4579495cD78280e4900CB482C8Edf2EC8336';

// TODO Add Image src
export const VL_YCRV = {
	label: 'vl-yCRV',
	symbol: 'vl-yCRV',
	decimals: 18,
	value: VL_YCRV_TOKEN_ADDRESS,
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
