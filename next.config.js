/* eslint-disable @typescript-eslint/explicit-function-return-type */
const runtimeCaching = require('next-pwa/cache');
const withTM = require('next-transpile-modules')(['@yearn-finance/web-lib'], {resolveSymlinks: false});
const withPWA = require('next-pwa')({
	dest: './public/',
	register: true,
	skipWaiting: true,
	runtimeCaching,
	buildExcludes: [/middleware-manifest.json$/]
});
const withBundleAnalyzer = require('@next/bundle-analyzer')({
	enabled: process.env.ANALYZE === 'true'
});

module.exports = withTM(withBundleAnalyzer(withPWA({
	images: {
		domains: [
			'rawcdn.githack.com',
			'raw.githubusercontent.com',
			'placehold.co',
			'assets.smold.app'
		]
	},
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
				has: [{type: 'host', value: 'yearn.fi'}],
				destination: 'https://yearn.finance/vaults/:path*',
				permanent: true
			},
			{
				source: '/:path*',
				has: [{type: 'host', value: 'y.finance'}],
				destination: 'https://yearn.finance/ycrv/:path*',
				permanent: true
			},
			{
				source: '/:path*',
				has: [{type: 'host', value: 'ybribe.com'}],
				destination: 'https://yearn.finance/ybribe/:path*',
				permanent: true
			},
			{
				source: '/:path*',
				has: [{type: 'host', value: 'vote.yearn.finance'}],
				destination: 'https://yearn.finance/veyfi/:path*',
				permanent: true
			},
			//
			{
				source: '/twitter',
				destination: 'https://twitter.com/iearnfinance',
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
				destination: 'https://gov.yearn.finance/',
				permanent: true
			},
			{
				source: '/snapshot',
				destination: 'https://snapshot.org/#/ybaby.eth',
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
			1: process.env.RPC_URL_MAINNET || 'https://eth.llamarpc.com',
			10: process.env.RPC_URL_OPTIMISM,
			137: process.env.RPC_URL_POLYGON,
			250: process.env.RPC_URL_FANTOM,
			42161: process.env.RPC_URL_ARBITRUM
		},
		ALCHEMY_KEY: process.env.ALCHEMY_KEY,
		INFURA_KEY: process.env.INFURA_KEY,

		PARTNER_ID_ADDRESS: '0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52',
		SHOULD_USE_PARTNER_CONTRACT: true,
		YDAEMON_BASE_URI: 'https://ydaemon.ycorpo.com',
		// YDAEMON_BASE_URI: 'https://ydaemon.yearn.finance',
		// YDAEMON_BASE_URI: 'https://ydaemon-dev.yearn.finance',
		// YDAEMON_BASE_URI: 'https://api.ycorpo.com',
		// YDAEMON_BASE_URI: 'http://localhost:8080',
		BASE_YEARN_ASSETS_URI: 'https://assets.smold.app/api/token'
	}
})));


if (process.env.NODE_ENV === 'production') {
	const {withSentryConfig} = require('@sentry/nextjs');
	module.exports = withSentryConfig(
		module.exports,
		{
		// For all available options, see:
		// https://github.com/getsentry/sentry-webpack-plugin#options

			// Suppresses source map uploading logs during build
			silent: true,

			org: 'xopowo-team',
			project: 'yearn-fi'
		},
		{
		// For all available options, see:
		// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

			// Upload a larger set of source maps for prettier stack traces (increases build time)
			widenClientFileUpload: true,

			// Transpiles SDK to be compatible with IE11 (increases bundle size)
			transpileClientSDK: true,

			// Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
			tunnelRoute: '/monitoring',

			// Hides source maps from generated client bundles
			hideSourceMaps: true,

			// Automatically tree-shake Sentry logger statements to reduce bundle size
			disableLogger: true
		}
	);
}
