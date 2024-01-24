/* eslint-disable @typescript-eslint/explicit-function-return-type */
const runtimeCaching = require('next-pwa/cache');
// eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
// const withTM = require('next-transpile-modules')(['@yearn-finance/web-lib'], {resolveSymlinks: false});
const withPWA = require('next-pwa')({
	dest: 'public',
	register: true,
	skipWaiting: true,
	runtimeCaching,
	buildExcludes: [/middleware-manifest.json$/]
});

const withBundleAnalyzer = require('@next/bundle-analyzer')({
	enabled: process.env.ANALYZE === 'true'
});

const config = {
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
				source: '/:path*',
				has: [{type: 'host', value: 'ybribe.com'}],
				destination: 'https://yearn.fi/ybribe/:path*',
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
			}
		];
	},
	env: {
		/* 🔵 - Yearn Finance **************************************************
		 ** Config over the RPC
		 **********************************************************************/
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
		// YDAEMON_BASE_URI: 'https://ydaemon.ycorpo.com',
		// YDAEMON_BASE_URI: 'http://localhost:8080',
		// YDAEMON_BASE_URI: 'https://api.ycorpo.com',
		BASE_YEARN_ASSETS_URI: 'https://assets.smold.app/api/token',
		BASE_YEARN_CHAIN_URI: 'https://assets.smold.app/api/chain',
		SMOL_ASSETS_URL: 'https://assets.smold.app/api'
	}
};

module.exports = process.env.NODE_ENV === 'development' ? withBundleAnalyzer(config) : withPWA(config);
