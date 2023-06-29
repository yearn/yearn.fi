import {arbitrum, fantom, gnosis} from 'viem/chains';
import {configureChains, createConfig, mainnet} from 'wagmi';
import {CoinbaseWalletConnector} from 'wagmi/connectors/coinbaseWallet';
import {LedgerConnector} from 'wagmi/connectors/ledger';
import {MetaMaskConnector} from 'wagmi/connectors/metaMask';
import {SafeConnector} from 'wagmi/connectors/safe';
import {WalletConnectConnector} from 'wagmi/connectors/walletConnect';
import {alchemyProvider} from 'wagmi/providers/alchemy';
import {publicProvider} from 'wagmi/providers/public';
import {InjectedConnector} from '@yearn-finance/web-lib/utils/web3/injectedConnector';
import {IFrameEthereumConnector} from '@yearn-finance/web-lib/utils/web3/ledgerConnector';
import {getRPC} from '@yearn-finance/web-lib/utils/web3/providers';
import {localhost, optimism, polygon} from '@common/utils/wagmiNetworks';

const {chains, publicClient, webSocketPublicClient} = configureChains(
	[mainnet, optimism, polygon, gnosis, fantom, arbitrum, localhost],
	[
		publicProvider(),
		alchemyProvider({apiKey: process.env.ALCHEMY_KEY || ''})
	]
);

const config = createConfig({
	autoConnect: true,
	publicClient,
	webSocketPublicClient,
	connectors: [
		new SafeConnector({chains, options: {allowedDomains: [/gnosis-safe.io/, /app.safe.global/]}}),
		new IFrameEthereumConnector({chains, options: {}}),
		new InjectedConnector({chains}),
		new MetaMaskConnector(),
		new LedgerConnector({chains, options: {}}),
		new WalletConnectConnector({
			chains,
			options: {projectId: process.env.WALLETCONNECT_PROJECT_ID as string}
		}),
		new CoinbaseWalletConnector({
			options: {
				jsonRpcUrl: getRPC(1),
				appName: process.env.WEBSITE_TITLE as string
			}
		})
	]
});

export default config;
