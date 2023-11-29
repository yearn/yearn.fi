import React, {Fragment, memo} from 'react';
import localFont from 'next/font/local';
import {usePathname} from 'next/navigation';
import {type NextRouter, useRouter} from 'next/router';
import {AnimatePresence, domAnimation, LazyMotion, motion} from 'framer-motion';
import {useLocalStorageValue} from '@react-hookz/web';
import {arbitrum, base, fantom, mainnet, optimism, polygon} from '@wagmi/chains';
import {WithYearn} from '@yearn-finance/web-lib/contexts/WithYearn';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {localhost} from '@yearn-finance/web-lib/utils/wagmi/networks';
import {AppHeader} from '@common/components/AppHeader';
import Meta from '@common/components/Meta';
import {Popover} from '@common/components/Popover';
import {MenuContextApp} from '@common/contexts/useMenu';
import {WalletContextApp} from '@common/contexts/useWallet';
import {YearnContextApp} from '@common/contexts/useYearn';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';

import type {NextComponentType} from 'next';
import type {AppProps} from 'next/app';
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
		},
		{
			path: '../public/fonts/Aeonik-Black.ttf',
			weight: '900',
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
	const router = useRouter();
	const {Component, pageProps} = props;
	const pathName = usePathname();
	const getLayout = (Component as TGetLayout).getLayout || ((page: ReactElement): ReactElement => page);
	const {value: shouldHidePopover} = useLocalStorageValue<boolean>('yearn.fi/feedback-popover');
	const {name} = useCurrentApp(router);

	return (
		<>
			<div className={cl('mx-auto mb-0 flex font-aeonik max-w-6xl absolute top-0 inset-x-0')}>
				<AppHeader />
			</div>
			<div
				id={'app'}
				className={cl('mx-auto mb-0 flex font-aeonik')}>
				<div className={'block h-full min-h-max w-full'}>
					<LazyMotion features={domAnimation}>
						<AnimatePresence mode={'wait'}>
							<motion.div
								key={`${name}_${pathName}`}
								initial={'initial'}
								animate={'enter'}
								exit={'exit'}
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
		</>
	);
});

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
		<main className={cl(aeonik.className, 'h-full min-h-screen w-full font-aeonik', '')}>
			<WithYearn
				supportedChains={[mainnet, optimism, polygon, fantom, base, arbitrum, localhost]}
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
