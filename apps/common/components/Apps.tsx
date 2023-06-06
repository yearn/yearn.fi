import Image from 'next/image';
import vaultsManifest from 'public/apps/vaults-manifest.json';
import veyfiManifest from 'public/apps/veyfi-manifest.json';
import yBalManifest from 'public/apps/ybal-manifest.json';
import ybribeManifest from 'public/apps/ybribe-manifest.json';
import ycrvManifest from 'public/apps/ycrv-manifest.json';
import {VAULTS_MENU} from '@vaults/constants/menu';
import {VEYFI_MENU} from '@veYFI/constants/menu';
import {YBAL_TOKEN_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import LogoYearn from '@common/icons/LogoYearn';
import {YBAL_MENU} from '@yBal/constants/menu';
import {YBRIBE_MENU} from '@yBribe/constants/menu';
import {YCRV_MENU} from '@yCRV/constants/menu';

import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/components/Header';
import type {TMetaFile} from './Meta';

export enum AppName {
	VAULTS = 'Vaults',
	YCRV = 'yCRV',
	YBAL = 'yBal',
	VEYFI = 'veYFI',
	YBRIBE = 'yBribe'
}

type TApp = {
	name: AppName;
	href: string;
	menu: TMenu[];
	manifest: TMetaFile;
	icon: ReactElement;
	isDisabled?: boolean;
}

export const APPS: { [key in AppName]: TApp } = {
	Vaults: {
		name: AppName.VAULTS,
		href: '/vaults',
		menu: VAULTS_MENU,
		manifest: vaultsManifest,
		icon: <LogoYearn
			className={'h-8 w-8'}
			back={'text-pink-400'}
			front={'text-white'} />
	},
	yCRV: {
		name: AppName.YCRV,
		href: '/ycrv',
		menu: YCRV_MENU,
		manifest: ycrvManifest,
		icon: (
			<Image
				alt={'yCRV'}
				width={32}
				height={32}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	},
	yBal: {
		name: AppName.YBAL,
		href: '/ybal',
		menu: YBAL_MENU,
		manifest: yBalManifest,
		isDisabled: true,
		icon: (
			<Image
				alt={'yBal'}
				width={32}
				height={32}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YBAL_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	},
	veYFI: {
		name: AppName.VEYFI,
		menu: VEYFI_MENU,
		href: '/veyfi',
		manifest: veyfiManifest,
		icon: <LogoYearn
			className={'h-8 w-8'}
			back={'text-primary'}
			front={'text-white'} />
	},
	yBribe: {
		name: AppName.YBRIBE,
		href: '/ybribe',
		menu: YBRIBE_MENU,
		manifest: ybribeManifest,
		icon: <LogoYearn
			className={'h-8 w-8'}
			back={'text-neutral-900'}
			front={'text-neutral-0'} />
	}
};
