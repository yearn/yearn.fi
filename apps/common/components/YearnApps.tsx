import Image from 'next/image';
import {toAddress} from '@builtbymom/web3/utils';
import {LogoGimme} from '@common/icons/LogoGimme';

import {LogoYearn} from '../icons/LogoYearn';

const YCRV_TOKEN_ADDRESS = toAddress('0xFCc5c47bE19d06BF83eB04298b026F81069ff65b');
const VEYFI_DYFI_ADDRESS = toAddress('0x41252E8691e964f7DE35156B68493bAb6797a275');

export const APPS = {
	V3: {
		name: 'V3 Vaults',
		href: 'https://yearn.fi/v3',
		host: ['yearn.fi'],
		pathname: '/v3',
		icon: (
			<LogoYearn
				className={'size-8'}
				gradient={{start: '#FB245A', end: '#0657F9'}}
				front={'text-white'}
			/>
		)
	},
	Vaults: {
		name: 'Vaults',
		href: 'https://yearn.fi/vaults',
		host: ['localhost:3000/vaults', 'https://yearn.fi/vaults'],
		pathname: '/vaults',
		icon: (
			<LogoYearn
				className={'size-8'}
				back={'text-[#f472b6]'}
				front={'text-white'}
			/>
		)
	},
	yCRV: {
		name: 'yCRV',
		href: 'https://ycrv.yearn.fi',
		host: ['ycrv.yearn.fi'],
		pathname: 'unused',
		icon: (
			<Image
				alt={'yCRV'}
				className={'!size-8 !max-h-8 !max-w-8'}
				width={64}
				height={64}
				src={`${process.env.SMOL_ASSETS_URL}/token/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	veYFI: {
		name: 'Governance',
		href: 'https://veyfi.yearn.fi',
		host: ['veyfi.yearn.fi'],
		pathname: 'unused',
		icon: (
			<Image
				alt={'veYFI'}
				className={'!size-8 !max-h-8 !max-w-8'}
				width={64}
				height={64}
				src={`${process.env.SMOL_ASSETS_URL}/token/1/${VEYFI_DYFI_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	yFactory: {
		name: 'yFactory',
		href: 'https://factory.yearn.fi',
		host: ['factory.yearn.fi'],
		pathname: 'unused',
		icon: (
			<LogoYearn
				className={'!size-6 !max-h-6 !max-w-6'}
				back={'text-neutral-0'}
				front={'text-neutral-900'}
			/>
		)
	},
	analytics: {
		name: 'Analytics',
		href: 'https://yearn-powerglove.vercel.app/',
		host: ['yearn-powerglove.vercel.app'],
		pathname: 'unused',
		icon: (
			<LogoYearn
				className={'!size-6 !max-h-6 !max-w-6'}
				back={'text-white'}
				front={'text-black'}
			/>
		)
	},
	docs: {
		name: 'Docs',
		href: 'https://docs.yearn.fi',
		host: ['docs.yearn.fi'],
		pathname: 'unused',
		icon: (
			<LogoYearn
				className={'!size-6 !max-h-6 !max-w-6'}
				back={'text-primary'}
				front={'text-white'}
			/>
		)
	},
	yETH: {
		name: 'yETH',
		href: 'https://yeth.yearn.fi',
		host: ['yeth.yearn.fi'],
		pathname: 'unused',
		icon: (
			<Image
				alt={'yETH'}
				className={'!size-8 !max-h-8 !max-w-8'}
				width={64}
				height={64}
				src={`${process.env.SMOL_ASSETS_URL}/token/1/0x1BED97CBC3c24A4fb5C069C6E311a967386131f7/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	yPrisma: {
		name: 'yPrisma',
		href: 'https://yprisma.yearn.fi',
		host: ['yprisma.yearn.fi'],
		pathname: 'unused',
		icon: (
			<Image
				priority
				src={`${process.env.SMOL_ASSETS_URL}/token/1/0xe3668873d944e4a949da05fc8bde419eff543882/logo-128.png`}
				className={'!size-8 !max-h-8 !max-w-8'}
				width={64}
				height={64}
				alt={'yPrisma'}
			/>
		)
	},
	Gimme: {
		name: 'GIMME',
		href: 'https://gimme.mom',
		host: ['gimme.mom'],
		pathname: 'unused',
		icon: <LogoGimme className={'size-8'} />
	}
};
