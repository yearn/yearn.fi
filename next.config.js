/* eslint-disable @typescript-eslint/explicit-function-return-type */
const withPWA = require('next-pwa')({
	dest: 'public',
	disable: process.env.NODE_ENV !== 'production'
});
const {PHASE_EXPORT} = require('next/constants');


module.exports = (phase) => withPWA({
	assetPrefix: process.env.IPFS_BUILD === 'true' || phase === PHASE_EXPORT ? './' : '/',
	images: {
		unoptimized: process.env.IPFS_BUILD === 'true' || phase === PHASE_EXPORT, //Exporting image does not support optimization
		domains: [
			'rawcdn.githack.com',
			'raw.githubusercontent.com'
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
			1: process.env.RPC_URL_MAINNET,
			10: process.env.RPC_URL_OPTIMISM,
			250: process.env.RPC_URL_FANTOM,
			42161: process.env.RPC_URL_ARBITRUM
		},
		ALCHEMY_KEY: process.env.ALCHEMY_KEY,
		INFURA_KEY: process.env.INFURA_KEY,

		// YDAEMON_BASE_URI: 'https://api.ycorpo.com',
		YDAEMON_BASE_URI: 'https://ydaemon-dev.yearn.finance',
		// YDAEMON_BASE_URI: 'http://localhost:8080',
		BASE_YEARN_ASSETS_URI: 'https://raw.githubusercontent.com/yearn/yearn-assets/master/icons/multichain-tokens/',

		YVECRV_TOKEN_ADDRESS: '0xc5bDdf9843308380375a611c18B50Fb9341f502A',
		YVBOOST_TOKEN_ADDRESS: '0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a',
		CRV_TOKEN_ADDRESS: '0xD533a949740bb3306d119CC777fa900bA034cd52',

		THREECRV_TOKEN_ADDRESS: '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490',
		YVECRV_POOL_LP_ADDRESS: '0x7E46fd8a30869aa9ed55af031067Df666EfE87da',

		YCRV_TOKEN_ADDRESS: '0xFCc5c47bE19d06BF83eB04298b026F81069ff65b',
		STYCRV_TOKEN_ADDRESS: '0x27B5739e22ad9033bcBf192059122d163b60349D',
		LPYCRV_TOKEN_ADDRESS: '0xc97232527B62eFb0D8ed38CF3EA103A6CcA4037e',
		GAUGEYCRV_TOKEN_ADDRESS: '0x5980d25B4947594c26255C0BF301193ab64ba803',
		ZAP_YEARN_VE_CRV_ADDRESS: '0x01D7f32B6E463c96c00575fA97B8224326C6A6B9',

		YCRV_CURVE_POOL_ADDRESS: '0x453D92C7d4263201C69aACfaf589Ed14202d83a4',
		VECRV_ADDRESS: '0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2',
		VECRV_YEARN_TREASURY_ADDRESS: '0xF147b8125d2ef93FB6965Db97D6746952a133934',

		
		VLYCRV_TOKEN_ADDRESS: '0x0000000000000000000000000000000000000004'
	}
});

