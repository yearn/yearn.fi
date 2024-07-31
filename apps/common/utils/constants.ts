import {arbitrum, base, fantom, mainnet, optimism, polygon} from 'viem/chains';
import {toAddress} from '@builtbymom/web3/utils';

import type {TApp} from 'pages/home/[category]';
import type {TAddress, TNDict} from '@builtbymom/web3/types';

export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_MAX_LOSS = 1n;
export const YGAUGES_ZAP_ADDRESS = toAddress('0x1104215963474A0FA0Ac09f4E212EF7282F2A0bC'); //Address of the zap to deposit & stake in the veYFI gauge
export const V3_STAKING_ZAP_ADDRESS: TNDict<TAddress> = {
	[mainnet.id]: toAddress('0x5435cA9b6D9468A6e0404a4819D39ebbF036DB1E'),
	[arbitrum.id]: toAddress('0x1E789A49902370E5858Fae67518aF49d8deA299c')
}; //Address of the zap to deposit & stake for the v3 staking
export const SUPPORTED_NETWORKS = [mainnet, optimism, polygon, fantom, base, arbitrum];

export const COMMUNITY_APPS: TApp[] = [
	{
		title: 'Product name',
		description: 'Product description example text product description example text',
		image: ''
	},
	{
		title: 'Product name',
		description: 'Product description example text product description example text',
		image: ''
	},
	{
		title: 'Product name',
		description: 'Product description example text product description example text',
		image: ''
	},
	{
		title: 'Product name',
		description: 'Product description example text product description example text',
		image: ''
	}
];

export const YEARN_X_APPS = [
	{
		title: 'Pendle',
		description: 'Product description example text product description example text',
		image: ''
	},
	{
		title: 'Ajna',
		description: 'Product description example text product description example text',
		image: ''
	},
	{
		title: 'Optimism',
		description: 'Product description example text product description example text',
		image: ''
	},
	{
		title: 'Pool Together',
		description: 'Product description example text product description example text',
		image: ''
	}
];

export const FEATURED_APPS = [
	{
		title: 'Juiced',
		description: 'Product description example text product description example text',
		image: '/juiced-bg.png'
	},
	{
		title: 'Gimme',
		description: 'Product description example text product description example text',
		image: '/gimme-bg.png'
	},
	{
		title: 'V3 valuts',
		description: 'Product description example text product description example text',
		image: '/v3-bg.png'
	}
];

export const ALL_APPS = [...FEATURED_APPS, ...COMMUNITY_APPS, ...YEARN_X_APPS];

export const CATEGORIES_DICT = {
	'featured-apps': {
		categoryName: 'Featured apps',
		categoryDescription:
			'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
		catrgorySlug: 'featured-apps',
		apps: FEATURED_APPS
	},
	community: {
		categoryName: 'Community Apps',
		categoryDescription:
			'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
		catrgorySlug: 'community-apps',
		apps: COMMUNITY_APPS
	},
	'yearn-x': {
		categoryName: 'Yearn X Projects',
		categoryDescription:
			'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
		catrgorySlug: 'yearn-x',
		apps: YEARN_X_APPS
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
