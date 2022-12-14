import {toAddress} from '@yearn-finance/web-lib/utils/address';

import {VYEMPIRE_SWAPPER_ADDRESS} from './constants';

import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type TMigrationTable = {
	service: number;
	symbol: string;
	zapVia: TAddress;
	migrableToken: TAddress;
	underlyingToken: TAddress;
}

export enum EXTERNAL_SERVICE_PROVIDER {
	COMPOUND = 0,
	AAVEV1 = 1,
	AAVEV2 = 2
}

//TODO: ADD FOR SPECIFIC CHAINS
export const	migrationTable: TDict<TMigrationTable[]> = {
	[toAddress('0x6b175474e89094c44da98b954eedeac495271d0f')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.COMPOUND,
			symbol: 'cDAI',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x5d3a536e4d6dbd6114cc1ead35777bab948e3643'),
			underlyingToken: toAddress('0x6b175474e89094c44da98b954eedeac495271d0f')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aDAIv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d'),
			underlyingToken: toAddress('0x6b175474e89094c44da98b954eedeac495271d0f')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aDAIv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x028171bca77440897b824ca71d1c56cac55b68a3'),
			underlyingToken: toAddress('0x6b175474e89094c44da98b954eedeac495271d0f')
		}
	],
	[toAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.COMPOUND,
			symbol: 'cUSDC',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x39aa39c021dfbae8fac545936693ac917d5e7563'),
			underlyingToken: toAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aUSDCv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x9bA00D6856a4eDF4665BcA2C2309936572473B7E'),
			underlyingToken: toAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aUSDCv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xBcca60bB61934080951369a648Fb03DF4F96263C'),
			underlyingToken: toAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
		}
	],
	[toAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.COMPOUND,
			symbol: 'cUSDT',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9'),
			underlyingToken: toAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aUSDTv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x71fc860F7D3A592A4a98740e39dB31d25db65ae8'),
			underlyingToken: toAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aUSDTv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811'),
			underlyingToken: toAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')
		}
	],
	[toAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aWETHv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x3a3A65aAb0dd2A17E3F1947bA16138cd37d08c04'),
			underlyingToken: toAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aWETHv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x030bA81f1c18d280636F32af80b9AAd02Cf0854e'),
			underlyingToken: toAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
		}
	],
	[toAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.COMPOUND,
			symbol: 'cWBTC',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xc11b1268c1a384e55c48c2391d8d480264a3a7f4'),
			underlyingToken: toAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.COMPOUND,
			symbol: 'cWBTCv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xccf4429db6322d5c611ee964527d42e5d685dd6a'),
			underlyingToken: toAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aWBTCv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xFC4B8ED459e00e5400be803A9BB3954234FD50e3'),
			underlyingToken: toAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aWBTCv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656'),
			underlyingToken: toAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')
		}
	],
	[toAddress('0x57Ab1ec28D129707052df4dF418D58a2D46d5f51')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aSUSDv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x625aE63000f46200499120B906716420bd059240'),
			underlyingToken: toAddress('0x57Ab1ec28D129707052df4dF418D58a2D46d5f51')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aSUSDv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x6C5024Cd4F8A59110119C56f8933403A539555EB'),
			underlyingToken: toAddress('0x57Ab1ec28D129707052df4dF418D58a2D46d5f51')
		}
	],
	[toAddress('0x514910771AF9Ca656af840dff83E8264EcF986CA')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.COMPOUND,
			symbol: 'cLINK',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xface851a4921ce59e912d19329929ce6da6eb0c7'),
			underlyingToken: toAddress('0x514910771AF9Ca656af840dff83E8264EcF986CA')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aLINKv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xA64BD6C70Cb9051F6A9ba1F163Fdc07E0DfB5F84'),
			underlyingToken: toAddress('0x514910771AF9Ca656af840dff83E8264EcF986CA')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aLINKv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xa06bC25B5805d5F8d82847D191Cb4Af5A3e873E0'),
			underlyingToken: toAddress('0x514910771AF9Ca656af840dff83E8264EcF986CA')
		}
	],
	[toAddress('0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aSNXv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x328C4c80BC7aCa0834Db37e6600A6c49E12Da4DE'),
			underlyingToken: toAddress('0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aSNXv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x35f6B052C598d933D69A4EEC4D04c73A191fE6c2'),
			underlyingToken: toAddress('0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F')
		}
	],
	[toAddress('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.COMPOUND,
			symbol: 'cUNI',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x35a18000230da775cac24873d00ff85bccded550'),
			underlyingToken: toAddress('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aUNIv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xB124541127A0A657f056D9Dd06188c4F1b0e5aab'),
			underlyingToken: toAddress('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aUNIv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xB9D7CB55f463405CDfBe4E90a6D2Df01C2B92BF1'),
			underlyingToken: toAddress('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984')
		}
	],
	[toAddress('0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.COMPOUND,
			symbol: 'cYFI',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x80a2ae356fc9ef4305676f7a3e2ed04e12c33946'),
			underlyingToken: toAddress('0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			symbol: 'aYFIv1',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x12e51E77DAAA58aA0E9247db7510Ea4B46F9bEAd'),
			underlyingToken: toAddress('0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e')
		},
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aYFIv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0x5165d24277cD063F5ac44Efd447B27025e888f37'),
			underlyingToken: toAddress('0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e')
		}
	],
	[toAddress('0x03ab458634910aad20ef5f1c8ee96f1d6ac54919')]: [
		{
			service: EXTERNAL_SERVICE_PROVIDER.AAVEV2,
			symbol: 'aRAIv2',
			zapVia: VYEMPIRE_SWAPPER_ADDRESS,
			migrableToken: toAddress('0xc9BC48c72154ef3e5425641a3c747242112a46AF'),
			underlyingToken: toAddress('0x03ab458634910aad20ef5f1c8ee96f1d6ac54919')
		}
	]
};