/* eslint-disable @typescript-eslint/explicit-function-return-type */
const runtimeCaching = require('next-pwa/cache');
// eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
const {withPlausibleProxy} = require('next-plausible');
const withPWA = require('next-pwa')({
	dest: 'public',
	register: true,
	skipWaiting: true,
	runtimeCaching,
	buildExcludes: [/middleware-manifest.json$/]
});

module.exports = withPlausibleProxy({
	scriptName: 'script',
	customDomain: 'https://yearn.fi'
})(
	withPWA({
		images: {
			remotePatterns: [
				{
					protocol: 'https',
					hostname: 'rawcdn.githack.com'
				},
				{
					protocol: 'https',
					hostname: 'raw.githubusercontent.com'
				},
				{
					protocol: 'https',
					hostname: 'assets.smold.app'
				},
				{
					protocol: 'https',
					hostname: '**.yearn.fi'
				}
			]
		},
		experimental: {
			webpackBuildWorker: true
		},
		swcMinify: false,
		async rewrites() {
			return [
				{
					source: '/js/script.js',
					destination: 'https://plausible.io/js/script.js'
				},
				{
					source: '/api/event',
					destination: 'https://plausible.io/api/event'
				}
			];
		},
		redirects() {
			return [
				{
					source: '/ybribe/:path*',
					destination: 'https://ybribe.yearn.fi/:path*',
					permanent: true
				},
				{
					source: '/ycrv/:path*',
					destination: 'https://ycrv.yearn.fi/:path*',
					permanent: true
				},
				{
					source: '/veyfi/:path*',
					destination: 'https://veyfi.yearn.fi/:path*',
					permanent: true
				},
				{
					source: '/vaults/factory/:path*',
					destination: 'https://factory.yearn.fi/:path*',
					permanent: true
				},
				{
					source: '/:path*',
					has: [{type: 'host', value: 'vote.yearn.fi'}],
					destination: 'https://yearn.fi/veyfi/:path*',
					permanent: true
				},
				//
				{
					source: '/twitter',
					destination: 'https://twitter.com/yearnfi',
					permanent: true
				},
				{
					source: '/telegram',
					destination: 'https://t.me/yearnfinance/',
					permanent: true
				},
				{
					source: '/medium',
					destination: 'https://medium.com/iearn',
					permanent: true
				},
				{
					source: '/governance',
					destination: 'https://gov.yearn.fi/',
					permanent: true
				},
				{
					source: '/snapshot',
					destination: 'https://snapshot.org/#/veyfi.eth',
					permanent: true
				},
				{
					source: '/github',
					destination: 'https://github.com/yearn/yearn.fi',
					permanent: true
				}
			];
		},
		env: {
			/* 🔵 - Yearn Finance **************************************************
			 ** Config over the RPC
			 **********************************************************************/
			RPC_URI_FOR_1: process.env.RPC_URI_FOR_1,
			RPC_URI_FOR_10: process.env.RPC_URI_FOR_10,
			RPC_URI_FOR_137: process.env.RPC_URI_FOR_137,
			RPC_URI_FOR_252: process.env.RPC_URI_FOR_252,
			RPC_URI_FOR_288: process.env.RPC_URI_FOR_288,
			RPC_URI_FOR_8453: process.env.RPC_URI_FOR_8453,
			RPC_URI_FOR_42161: process.env.RPC_URI_FOR_42161,
			RPC_URI_FOR_42170: process.env.RPC_URI_FOR_42170,
			RPC_URI_FOR_56288: process.env.RPC_URI_FOR_56288,
			RPC_URI_FOR_81457: process.env.RPC_URI_FOR_81457,
			RPC_URI_FOR_111188: process.env.RPC_URI_FOR_111188,

			// Old setup
			WEB_SOCKET_URL: {
				1: process.env.WS_URL_MAINNET,
				10: process.env.WS_URL_OPTIMISM,
				137: process.env.WS_URL_POLYGON,
				250: process.env.WS_URL_FANTOM,
				42161: process.env.WS_URL_ARBITRUM
			},
			JSON_RPC_URL: {
				1: process.env.RPC_URL_MAINNET,
				10: process.env.RPC_URL_OPTIMISM,
				137: process.env.RPC_URL_POLYGON,
				250: process.env.RPC_URL_FANTOM,
				42161: process.env.RPC_URL_ARBITRUM
			},

			ALCHEMY_KEY: process.env.ALCHEMY_KEY,
			ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
			INFURA_PROJECT_ID: process.env.INFURA_PROJECT_ID,
			WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,

			PARTNER_ID_ADDRESS: '0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52',
			SHOULD_USE_PARTNER_CONTRACT: true,
			RANGE_LIMIT: 1_000_000,

			YDAEMON_BASE_URI: process.env.YDAEMON_BASE_URI,
			// YDAEMON_BASE_URI: 'http://localhost:8080',
			BASE_YEARN_ASSETS_URI: 'https://assets.smold.app/api/token',
			BASE_YEARN_CHAIN_URI: 'https://assets.smold.app/api/chain',
			SMOL_ASSETS_URL: 'https://assets.smold.app/api'
		}
	})
);
