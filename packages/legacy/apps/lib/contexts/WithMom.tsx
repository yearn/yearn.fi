import {Fragment, useMemo} from 'react';
import {type Chain} from 'viem/chains';
import {WagmiProvider} from 'wagmi';
import {RainbowKitProvider} from '@rainbow-me/rainbowkit';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {isIframe} from '../utils';
import {getConfig} from '../utils/wagmi/config';
import {Web3ContextApp} from './useWeb3';
import {WithTokenList} from './WithTokenList';

import type {ReactElement} from 'react';
import type {Config, State} from 'wagmi';
import type {AvatarComponent, DisclaimerComponent, Theme} from '@rainbow-me/rainbowkit';

type TWithMom = {
	children: ReactElement;
	initialState?: State;
	defaultNetwork?: Chain;
	supportedChains: Chain[];
	tokenLists?: string[];
	rainbowConfig?: {
		initialChain?: Chain | number;
		id?: string;
		theme?: Theme | null;
		showRecentTransactions?: boolean;
		appInfo?: {
			appName?: string;
			learnMoreUrl?: string;
			disclaimer?: DisclaimerComponent;
		};
		coolMode?: boolean;
		avatar?: AvatarComponent;
		modalSize?: 'compact' | 'wide';
	};
};

const queryClient = new QueryClient();
function WithMom({
	children,
	supportedChains,
	defaultNetwork,
	tokenLists,
	rainbowConfig,
	initialState
}: TWithMom): ReactElement {
	const config = useMemo(() => getConfig({chains: supportedChains}), [supportedChains]);

	return (
		<WagmiProvider
			config={config as Config}
			reconnectOnMount={!isIframe()}
			initialState={initialState}>
			<QueryClientProvider client={queryClient}>
				<RainbowKitProvider {...rainbowConfig}>
					<Web3ContextApp defaultNetwork={defaultNetwork}>
						<WithTokenList lists={tokenLists}>
							<Fragment>{children}</Fragment>
						</WithTokenList>
					</Web3ContextApp>
				</RainbowKitProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
}

export {WithMom};
