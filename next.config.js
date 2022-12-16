/* eslint-disable @typescript-eslint/explicit-function-return-type */
const runtimeCaching = require('next-pwa/cache');

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

module.exports = withBundleAnalyzer(withPWA({
	images: {
		domains: [
			'rawcdn.githack.com',
			'raw.githubusercontent.com',
			'placehold.co'
		]
	},
	env: {
		/* 🔵 - Yearn Finance **************************************************
		** Config over the RPC
		**********************************************************************/
		WEB_SOCKET_URL: {
			1: process.env.WS_URL_MAINNET,
			10: process.env.WS_URL_OPTIMISM,
			250: process.env.WS_URL_FANTOM,
			42161: process.env.WS_URL_ARBITRUM
		},
		JSON_RPC_URL: {
			1: 'https://1rpc.io/eth' || process.env.RPC_URL_MAINNET,
			10: process.env.RPC_URL_OPTIMISM,
			250: process.env.RPC_URL_FANTOM,
			42161: process.env.RPC_URL_ARBITRUM
		},
		ALCHEMY_KEY: process.env.ALCHEMY_KEY,
		INFURA_KEY: process.env.INFURA_KEY,

		PARTNER_ID_ADDRESS: '0x7eE89ddd96603669eB0CC92D81f221b756813872',
		SHOULD_USE_PARTNER_CONTRACT: true,
		// YDAEMON_BASE_URI: 'https://api.ycorpo.com',
		YDAEMON_BASE_URI: 'https://ydaemon-dev.yearn.finance',
		// YDAEMON_BASE_URI: 'http://localhost:8080',
		BASE_YEARN_ASSETS_URI: 'https://raw.githubusercontent.com/yearn/yearn-assets/master/icons/multichain-tokens/'
	}
}));

