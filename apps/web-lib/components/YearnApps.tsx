import {LogoGimme} from '../icons/LogoGimme';
import {LogoJuiced} from '../icons/LogoJuiced';
import {LogoYearn} from '../icons/LogoYearn';
import {VEYFI_DYFI_ADDRESS, YCRV_TOKEN_ADDRESS} from '../utils/constants';
import {ImageWithFallback} from './ImageWithFallback';

export const APPS = {
	V3: {
		name: 'V3 Vaults',
		href: 'https://yearn.fi/v3',
		host: 'yearn.fi',
		icon: (
			<LogoYearn
				className={'size-8'}
				back={'text-pink-400'}
				front={'text-white'}
			/>
		)
	},
	Juiced: {
		name: 'Juiced Vaults',
		href: 'https://juiced.yearn.fi',
		host: 'juiced.yearn.fi',
		icon: <LogoJuiced className={'size-8'} />
	},
	Gimme: {
		name: 'GIMME',
		href: 'https://gimme.mom',
		host: 'gimme.mom',
		icon: <LogoGimme className={'size-8'} />
	},
	Vaults: {
		name: 'Vaults',
		href: 'https://yearn.fi/vaults',
		host: 'yearn.fi:',
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
		host: 'ycrv.yearn.fi',
		icon: (
			<ImageWithFallback
				alt={'yCRV'}
				className={'size-8'}
				width={64}
				height={64}
				src={`${process.env.SMOL_ASSETS_URL}/token/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	veYFI: {
		name: 'veYFI',
		href: 'https://veyfi.yearn.fi',
		host: 'veyfi.yearn.fi',
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
	yETH: {
		name: 'yETH',
		href: 'https://yeth.yearn.fi',
		host: 'yeth.yearn.fi',
		icon: (
			<ImageWithFallback
				alt={'yETH'}
				className={'size-8'}
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
		host: 'yprisma.yearn.fi',
		icon: (
			<ImageWithFallback
				priority
				src={`${process.env.SMOL_ASSETS_URL}/token/1/0xe3668873d944e4a949da05fc8bde419eff543882/logo-128.png`}
				className={'size-8'}
				width={64}
				height={64}
				alt={'yPrisma'}
			/>
		)
	},
	yFactory: {
		name: 'yFactory',
		href: 'https://factory.yearn.fi',
		host: 'factory.yearn.fi',
		icon: (
			<LogoYearn
				className={'size-8'}
				back={'text-neutral-0'}
				front={'text-neutral-900'}
			/>
		)
	}
};
