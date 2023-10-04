import React, {Fragment, memo, useEffect} from 'react';
import localFont from 'next/font/local';
import useSWR from 'swr';
import {AnimatePresence, domAnimation, LazyMotion, motion} from 'framer-motion';
import {useIntervalEffect, useIsMounted, useLocalStorageValue} from '@react-hookz/web';
import {arbitrum, base, fantom, mainnet, optimism} from '@wagmi/chains';
import {WithYearn} from '@yearn-finance/web-lib/contexts/WithYearn';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {localhost} from '@yearn-finance/web-lib/utils/wagmi/networks';
import {AppHeader} from '@common/components/AppHeader';
import Meta from '@common/components/Meta';
import {Popover} from '@common/components/Popover';
import {MenuContextApp} from '@common/contexts/useMenu';
import {WalletContextApp} from '@common/contexts/useWallet';
import {YearnContextApp} from '@common/contexts/useYearn';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {IconSpinner} from '@common/icons/IconSpinner';
import {variants} from '@common/utils/animations';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {NextComponentType} from 'next';
import type {AppProps} from 'next/app';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

import '../style.css';

const aeonik = localFont({
	variable: '--font-aeonik',
	display: 'swap',
	src: [
		{
			path: '../public/fonts/Aeonik-Regular.woff2',
			weight: '400',
			style: 'normal'
		},
		{
			path: '../public/fonts/Aeonik-Bold.woff2',
			weight: '700',
			style: 'normal'
		}
	]
});

/** 🔵 - Yearn Finance ***************************************************************************
 ** The 'WithLayout' function is a React functional component that returns a ReactElement. It is used
 ** to wrap the current page component and provide layout for the page.
 **
 ** It uses the 'useLocalStorageValue' hook to get the value of 'yearn.fi/feedback-popover' from
 ** local storage. This value is used to determine whether to show the feedback popover.
 **
 ** The 'useCurrentApp' hook is used to get the current app name.
 ** The 'getLayout' function is used to get the layout of the current page component. If the current
 ** page component does not have a 'getLayout' function, it defaults to a function that returns the
 ** page as is.
 ** The returned JSX structure is a div with the 'AppHeader' component, the current page component
 ** wrapped with layout, and the feedback popover if it should not be hidden.
 **************************************************************************************************/
type TGetLayout = NextComponentType & {
	getLayout: (p: ReactElement, router: NextRouter) => ReactElement;
};
const WithLayout = memo(function WithLayout(props: AppProps): ReactElement {
	const {Component, pageProps, router} = props;
	const getLayout = (Component as TGetLayout).getLayout || ((page: ReactElement): ReactElement => page);
	const {value: shouldHidePopover} = useLocalStorageValue<boolean>('yearn.fi/feedback-popover');
	const {name} = useCurrentApp(router);

	return (
		<div
			id={'app'}
			className={'mx-auto mb-0 flex max-w-6xl font-aeonik'}>
			<div className={'block min-h-[100vh] w-full'}>
				<AppHeader />
				<LazyMotion features={domAnimation}>
					<AnimatePresence mode={'wait'}>
						<motion.div
							key={name}
							initial={'initial'}
							animate={'enter'}
							exit={'exit'}
							className={'my-0 h-full md:mb-0 md:mt-16'}
							variants={variants}>
							{getLayout(
								<Component
									router={props.router}
									{...pageProps}
								/>,
								router
							)}
							{!shouldHidePopover && <Popover />}
						</motion.div>
					</AnimatePresence>
				</LazyMotion>
			</div>
		</div>
	);
});

/* 🔵 - Yearn Finance ******************************************************************************
 ** The function 'NetworkStatusIndicator' is a React functional component that returns a
 ** ReactElement.
 ** It uses several hooks and functions to fetch and display the status of the network.
 **
 ** The 'useChainID' hook is used to get the current chain ID.
 ** The 'useIsMounted' hook is used to check if the component is currently mounted.
 ** The 'useYDaemonBaseURI' function is used to get the base URI of the yDaemon for the current
 ** chain ID.
 ** The 'useSWR' hook is used to fetch the status of the network from the yDaemon.
 **
 ** The 'useEffect' hook is used to re-fetch the status whenever the chain ID changes.
 ** The 'useIntervalEffect' hook is used to re-fetch the status every 10 seconds if the status is
 ** not 'OK'.
 **
 ** If the component is not mounted, or the status is 'OK' or undefined it returns an empty Fragment
 ** Otherwise, it returns a div with a spinner icon and a message indicating that the data points
 ** are being updated.
 **************************************************************************************************/
function NetworkStatusIndicator(): ReactElement {
	const {safeChainID} = useChainID();
	const isMounted = useIsMounted();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: safeChainID});
	const {data: status, mutate} = useSWR<'Not Started' | 'Loading' | 'OK'>(`${yDaemonBaseUri}/status`, baseFetcher, {
		revalidateOnFocus: true,
		revalidateOnReconnect: true,
		revalidateOnMount: true
	});

	useEffect((): void => {
		safeChainID;
		mutate();
	}, [mutate, safeChainID]);

	useIntervalEffect((): void => {
		if (status !== 'OK') {
			mutate();
		}
	}, 10000);

	if (!isMounted) {
		return <Fragment />;
	}
	if (status === 'OK') {
		return <Fragment />;
	}
	if (!status) {
		return <Fragment />;
	}

	return (
		<div className={'fixed inset-x-0 bottom-0 flex items-center justify-center space-x-2 bg-yearn-blue py-2 text-center text-sm text-white'}>
			<IconSpinner className={'h-3 w-3'} />
			<b>{"Updating data points, data may be inaccurate for a few minutes. Don't panic. DON'T PANIC!!!"}</b>
		</div>
	);
}

/**** 🔵 - Yearn Finance ***************************************************************************
 ** The 'App' function is a React functional component that returns a ReactElement. It uses several
 ** hooks and components to build the main structure of the application.
 **
 ** The 'useCurrentApp' hook is used to get the current app manifest.
 **
 ** The 'MenuContextApp', 'YearnContextApp', and 'WalletContextApp' are context providers that
 ** provide global state for the menu, Yearn, and wallet respectively.
 ** The 'Meta' component is used to set the meta tags for the page.
 ** The 'WithLayout' component is a higher-order component that wraps the current page component
 ** and provides layout for the page.
 **
 ** The 'NetworkStatusIndicator' component is used to display the network status.
 ** The returned JSX structure is wrapped with the context providers and includes the meta tags,
 ** layout, and network status indicator.
 **************************************************************************************************/
const App = memo(function App(props: AppProps): ReactElement {
	const {Component, pageProps, router} = props;
	const {manifest} = useCurrentApp(router);

	return (
		<MenuContextApp>
			<YearnContextApp>
				<WalletContextApp>
					<Fragment>
						<Meta meta={manifest} />
						<WithLayout
							Component={Component}
							pageProps={pageProps}
							router={props.router}
						/>
						<NetworkStatusIndicator />
					</Fragment>
				</WalletContextApp>
			</YearnContextApp>
		</MenuContextApp>
	);
});

/**** 🔵 - Yearn Finance ***************************************************************************
 ** The 'MyApp' function is a React functional component that returns a ReactElement. It is the main
 ** entry point of the application.
 **
 ** It uses the 'WithYearn' context provider to provide global state for Yearn. The 'WithYearn'
 ** component is configured with a list of supported chains and some options.
 **
 ** The 'App' component is wrapped with the 'WithYearn' component to provide it with the Yearn
 ** context.
 **
 ** The returned JSX structure is a main element with the 'WithYearn' and 'App' components.
 **************************************************************************************************/
function MyApp(props: AppProps): ReactElement {
	return (
		<main
			id={'main'}
			className={aeonik.className}>
			<WithYearn
				supportedChains={[mainnet, optimism, fantom, base, arbitrum, localhost]}
				options={{
					baseSettings: {
						yDaemonBaseURI: process.env.YDAEMON_BASE_URI as string
					},
					ui: {shouldUseThemes: false}
				}}>
				<App {...props} />
			</WithYearn>
		</main>
	);
}

export default MyApp;
