import {arbitrum, base, fantom, mainnet, optimism, polygon} from 'viem/chains';
import {toAddress} from '@lib/utils';
import {IconAbout} from '@common/icons/IconAbout';
import {IconFrontends} from '@common/icons/IconFrontends';
import {IconIntegrations} from '@common/icons/IconIntegrations';
import {IconVaults} from '@common/icons/IconVaults';
import {IconYearn} from '@common/icons/IconYearn';
import {IconYearnXApps} from '@common/icons/IconYearnXApps';

import type {TApp} from '@common/types/category';
import type {TAddress, TNDict} from '@lib/types';

export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_MAX_LOSS = 1n;
export const YGAUGES_ZAP_ADDRESS = toAddress('0x1104215963474A0FA0Ac09f4E212EF7282F2A0bC'); //Address of the zap to deposit & stake in the veYFI gauge
export const VEYFI_ADDRESS = toAddress('0x90c1f9220d90d3966FbeE24045EDd73E1d588aD5'); //Address of the veYFI contract
export const V3_STAKING_ZAP_ADDRESS: TNDict<TAddress> = {
	[mainnet.id]: toAddress('0x5435cA9b6D9468A6e0404a4819D39ebbF036DB1E'),
	[arbitrum.id]: toAddress('0x1E789A49902370E5858Fae67518aF49d8deA299c')
}; //Address of the zap to deposit & stake for the v3 staking
export const SUPPORTED_NETWORKS = [mainnet, optimism, polygon, fantom, base, arbitrum];

export const VAULTS_APPS: TApp[] = [
	{
		name: 'Gimme',
		description: 'DeFi yields, designed for everyone.',
		logoURI: 'https://gimme.mom/favicons/favicon-96x96.png',
		appURI: 'https://gimme.mom/'
	},
	{
		name: 'Vaults',
		description: 'The full Yearn experience with all Vaults, for sophisticated users.',
		logoURI: '/v3.png',
		appURI: '/v3'
	},
	{
		name: 'Vaults V2',
		description: "Discover Vaults from Yearn's v2 era.",
		logoURI: '/v2.png',
		appURI: '/vaults'
	},
	{
		name: 'Juiced',
		description: 'Discover yields juiced with extra token rewards.',
		logoURI: '/juiced-featured.jpg',
		appURI: 'https://juiced.app/'
	}
];

export const YEARN_APPS: TApp[] = [
	{
		name: 'yETH',
		description: 'A basket of LSTs in a single token.',
		logoURI: 'https://yeth.yearn.fi/favicons/favicon-96x96.png',
		appURI: 'https://yeth.yearn.fi/'
	},
	{
		name: 'veYFI',
		description: 'Stake YFI to earn yield, boost gauges, and take part in governance.',
		logoURI: 'https://assets.smold.app/api/token/1/0x41252E8691e964f7DE35156B68493bAb6797a275/logo-128.png',
		appURI: 'https://veyfi.yearn.fi'
	},
	{
		name: 'yCRV',
		description: 'Put your yCRV to work.',
		logoURI: 'https://ycrv.yearn.fi/ycrv-logo.svg',
		appURI: 'https://ycrv.yearn.fi'
	},
	{
		name: 'yPrisma',
		description: 'Put your yPRISMA to work.',
		logoURI: 'https://assets.smold.app/api/token/1/0xe3668873d944e4a949da05fc8bde419eff543882/logo-128.png',
		appURI: 'https://yprisma.yearn.fi'
	}
];

export const YEARN_X_APPS: TApp[] = [
	{
		name: 'PoolTogether',
		description: 'Get the best risk adjusted PoolTogether yields, with Yearn.',
		logoURI: 'https://pooltogether.yearn.space/favicons/favicon-512x512.png',
		appURI: 'https://pooltogether.yearn.space'
	},
	{
		name: 'Pendle',
		description: 'The best Pendle yields, with auto-rolling functionality.',
		logoURI: 'https://pendle.yearn.space/favicons/favicon-512x512.png',
		appURI: 'https://pendle.yearn.space'
	},
	{
		name: 'AJNA',
		description: 'Get the best risk adjusted Ajna yields, with Yearn.',
		logoURI: 'https://ajna.yearn.space/favicons/favicon-512x512.png',
		appURI: 'https://ajna.yearn.space'
	},
	{
		name: 'Velodrome',
		description: 'Get the best risk adjusted Velodrome yields, with Yearn.',
		logoURI: 'https://velodrome.yearn.space/favicons/favicon-512x512.png',
		appURI: 'https://velodrome.yearn.space/'
	},
	{
		name: 'Aerodrome',
		description: 'Get the best risk adjusted Aerodrome yields, with Yearn.',
		logoURI: 'https://aerodrome.yearn.space/favicons/favicon-512x512.png',
		appURI: 'https://aerodrome.yearn.space/'
	},
	{
		name: 'Curve',
		description: 'Get the best risk adjusted Curve yields, with Yearn.',
		logoURI: 'https://curve.yearn.space/favicons/favicon-512x512.png',
		appURI: 'https://curve.yearn.space/'
	},
	{
		name: 'Morpho',
		description: 'Time to feel the 🦋 effect!',
		logoURI: 'https://morpho.yearn.space/favicons/favicon-512x512.png',
		appURI: 'https://morpho.yearn.space'
	}
];

export const POOLS_APPS: TApp[] = [];

export const INTEGRATIONS_APPS: TApp[] = [
	{
		name: 'Cove',
		description: 'Earn the best yields on-chain without the hassle of managing a portfolio.',
		logoURI:
			'https://assets-global.website-files.com/651af12fcd3055636b6ac9ad/66242dbf1d6e7ff1b18336c4_Twitter%20pp%20-%20Logo%202.png',
		appURI: 'https://cove.finance/'
	},
	{
		name: '1UP',
		description: '1UP is a public good liquid locker for YFI.',
		logoURI: 'https://1up.tokyo/logo.svg',
		appURI: 'https://1up.tokyo/'
	},
	{
		name: 'StakeDAO',
		description: 'A non-custodial liquid staking platform focused on governance tokens.',
		logoURI: 'https://www.stakedao.org/logo.png',
		appURI: 'https://www.stakedao.org'
	},
	{
		name: 'Sturdy',
		description: 'Isolated lending with shared liquidity.',
		logoURI: 'https://avatars.githubusercontent.com/u/90377574?s=200&v=4',
		appURI: 'https://v2.sturdy.finance'
	},
	{
		name: 'PWN',
		description: 'PWN is a hub for peer-to-peer (P2P) loans backed by digital assets.',
		logoURI:
			'https://3238501125-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FtZYbaMzoeA7Kw4Stxzvw%2Ficon%2F89KZ4VyGSZ33cSf5QBmo%2Fpwn.svg?alt=media',
		appURI: 'https://app.pwn.xyz/'
	},
	{
		name: 'Superform',
		description: 'Superform grows your onchain wealth. Earn the best returns on your crypto.',
		logoURI: 'https://www.superform.xyz/icon.png',
		appURI: 'https://www.superform.xyz'
	}
];

export const FEATURED_APPS = [
	{
		name: 'yCRV',
		description: "Let Yearn's veCRV position boost your CRV yield, while you chill.",
		logoURI: '/ycrv-featured.jpg',
		appURI: 'https://ycrv.yearn.fi/'
	},
	{
		name: 'Gimme',
		description: 'DeFi yields, designed for everyone.',
		logoURI: '/gimme-featured.jpg',
		appURI: 'https://gimme.mom/'
	},
	{
		name: 'Vaults',
		description: 'The full Yearn experience with all Vaults, for sophisticated users.',
		logoURI: '/v3-featured.jpg',
		appURI: '/v3'
	},
	{
		name: 'yCRV',
		description: "Let Yearn's veCRV position boost your CRV yield, while you chill.",
		logoURI: '/ycrv-featured.jpg',
		appURI: 'https://ycrv.yearn.fi/'
	},
	{
		name: 'Gimme',
		description: 'DeFi yields, designed for everyone.',
		logoURI: '/gimme-featured.jpg',
		appURI: 'https://gimme.mom/'
	},
	{
		name: 'Vaults',
		description: 'The full Yearn experience with all Vaults, for sophisticated users.',
		logoURI: '/v3-featured.jpg',
		appURI: '/v3'
	},
	{
		name: 'yCRV',
		description: "Let Yearn's veCRV position boost your CRV yield, while you chill.",
		logoURI: '/ycrv-featured.jpg',
		appURI: 'https://ycrv.yearn.fi/'
	},
	{
		name: 'Gimme',
		description: 'DeFi yields, designed for everyone.',
		logoURI: '/gimme-featured.jpg',
		appURI: 'https://gimme.mom/'
	},
	{
		name: 'Vaults',
		description: 'The full Yearn experience with all Vaults, for sophisticated users.',
		logoURI: '/v3-featured.jpg',
		appURI: '/v3'
	}
];

export const ALL_APPS = [...FEATURED_APPS, ...VAULTS_APPS, ...YEARN_APPS, ...YEARN_X_APPS, ...INTEGRATIONS_APPS];

export const CATEGORIES_DICT = {
	'featured-apps': {
		categoryName: 'Featured apps',
		categoryDescription:
			'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
		catrgorySlug: 'featured-apps',
		apps: FEATURED_APPS
	},
	vaults: {
		categoryName: 'Vaults',
		categoryDescription:
			'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
		catrgorySlug: 'vaults',
		apps: VAULTS_APPS
	},
	'yearn-apps': {
		categoryName: 'Yearn Apps',
		categoryDescription:
			'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
		catrgorySlug: 'yearn-apps',
		apps: YEARN_APPS
	},
	'yearn-x': {
		categoryName: 'Yearn X Projects',
		categoryDescription:
			'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
		catrgorySlug: 'yearn-x',
		apps: YEARN_X_APPS
	},
	integrations: {
		categoryName: 'Integrations',
		categoryDescription:
			'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
		catrgorySlug: 'integrations',
		apps: INTEGRATIONS_APPS
	}
};

export const LANDING_SIDEBAR_LINKS = [
	{title: 'Governance', href: 'https://gov.yearn.fi/'},
	{title: 'API', href: 'https://github.com/yearn/ydaemon'},
	{title: 'Docs', href: 'https://docs.yearn.fi/'},
	{title: 'Blog', href: 'https://blog.yearn.fi/'},
	{title: 'Support', href: 'https://discord.com/invite/yearn'},
	{title: 'Discord', href: 'https://discord.com/invite/yearn'},
	{title: 'Paragraph', href: ''},
	{title: 'Twitter', href: 'https://twitter.com/yearnfi'}
];

export const MENU_TABS = [
	{title: 'Home', route: 'apps'},
	{title: 'Vaults', route: 'vaults'},
	{title: 'Yearn Apps', route: 'yearn-apps'},
	{title: 'Yearn X Projects', route: 'yearn-x'},
	{title: 'Integrations', route: 'integrations'}
	// {title: 'About', route: 'about'}
];

export const CATEGORY_PAGE_FILTERS = [
	{title: 'All', value: 'all'},
	{title: 'Filter', value: 'filter'},
	{title: 'Tab', value: 'tab'},
	{title: 'Large Filter', value: 'large-filter'}
];

export const iconsDict = {
	apps: <IconYearn />,
	about: <IconAbout />,
	vaults: <IconVaults />,
	'yearn-apps': <IconFrontends />,
	'yearn-x': <IconYearnXApps />,
	integrations: <IconIntegrations />
};

/**************************************************************************************************
 ** List of vaults with disabled veYFI gauge. Hardcoded so users could still unstake/claim and
 ** exit.
 *************************************************************************************************/
export const DISABLED_VEYFI_GAUGES_VAULTS_LIST = [
	{address: '0x42842754aBce504E12C20E434Af8960FDf85C833', staking: '0xb98343536e584cf686427a54574567ba5bda8070'}
];
