import Image from 'next/image';
import {VEYFI_DYFI_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/components/Header';

export enum AppName {
	VAULTS = 'Vaults',
	YCRV = 'yCRV',
	VEYFI = 'veYFI',
	YETH = 'yETH',
	YPRISMA = 'yPrisma',
	JUICED = 'Juiced',
	GIMME = 'Gimme'
}

type TApp = {
	name: AppName | string;
	href: string;
	menu: TMenu[];
	manifest: any;
	icon: ReactElement;
	isDisabled?: boolean;
};

export const APPS: {[key in AppName]: TApp} = {
	Vaults: {
		name: AppName.VAULTS,
		href: 'https://yearn.fi/vaults',
		menu: [],
		manifest: {},
		icon: (
			<ImageWithFallback
				alt={'Vaults'}
				className={'size-8'}
				src={'/v2.png'}
				width={64}
				height={64}
				loading={'eager'}
				priority
			/>
		)
	},
	Juiced: {
		name: `${AppName.JUICED} Vaults`,
		href: 'https://juiced.yearn.fi',
		menu: [],
		manifest: {},
		icon: (
			<Image
				className={'size-8'}
				src={'/juiced.png'}
				width={64}
				height={64}
				alt={'juiced'}
				loading={'eager'}
				priority
			/>
		)
	},
	Gimme: {
		name: `${AppName.GIMME} Vaults`,
		href: 'https://gimme.mom',
		menu: [],
		manifest: {},
		icon: (
			<Image
				className={'size-8'}
				src={'/gimme.png'}
				width={64}
				height={64}
				alt={'gimme'}
				loading={'eager'}
				priority
			/>
		)
	},
	veYFI: {
		name: AppName.VEYFI,
		menu: [],
		href: 'https://veyfi.yearn.fi',
		manifest: {},
		icon: (
			<ImageWithFallback
				alt={'veYFI'}
				className={'size-8'}
				width={64}
				height={64}
				src={`${process.env.SMOL_ASSETS_URL}/token/1/${VEYFI_DYFI_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	yCRV: {
		name: AppName.YCRV,
		href: 'https://ycrv.yearn.fi',
		menu: [],
		manifest: {},
		icon: (
			<ImageWithFallback
				alt={'yCRV'}
				width={64}
				height={64}
				className={'size-8'}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	yETH: {
		name: AppName.YETH,
		href: 'https://yeth.yearn.fi',
		menu: [],
		manifest: {},
		icon: (
			<ImageWithFallback
				alt={'yETH'}
				width={64}
				height={64}
				className={'size-8'}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/0x1BED97CBC3c24A4fb5C069C6E311a967386131f7/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	yPrisma: {
		name: AppName.YPRISMA,
		href: 'https://yPrisma.yearn.fi',
		menu: [],
		manifest: {},
		icon: (
			<ImageWithFallback
				alt={'yPrisma'}
				width={64}
				height={64}
				className={'size-8'}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/0xe3668873d944e4a949da05fc8bde419eff543882/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	}
};
