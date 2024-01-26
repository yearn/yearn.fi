import React, {Fragment, memo} from 'react';
import {Toaster} from 'react-hot-toast';
import localFont from 'next/font/local';
import {usePathname} from 'next/navigation';
import {type NextRouter, useRouter} from 'next/router';
import {AnimatePresence, domAnimation, LazyMotion, motion} from 'framer-motion';
import {WithMom} from '@builtbymom/web3/contexts/WithMom';
import {WalletForZapAppContextApp} from '@vaults/contexts/useWalletForZaps';
import {arbitrum, base, fantom, mainnet, optimism, polygon} from '@wagmi/chains';
import {YearnContextApp} from '@yearn-finance/web-lib/contexts/useYearn';
import {IconAlertCritical} from '@yearn-finance/web-lib/icons/IconAlertCritical';
import {IconAlertError} from '@yearn-finance/web-lib/icons/IconAlertError';
import {IconCheckmark} from '@yearn-finance/web-lib/icons/IconCheckmark';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {localhost} from '@yearn-finance/web-lib/utils/wagmi/networks';
import AppHeader from '@common/components/Header';
import Meta from '@common/components/Meta';
import {MenuContextApp} from '@common/contexts/useMenu';
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
	const {name} = useCurrentApp(router);

	return (
		<>
			<div className={cl('mx-auto mb-0 flex font-aeonik max-w-6xl absolute top-0 inset-x-0')}>
				<AppHeader />
			</div>
			<div
				id={'app'}
				className={cl('mx-auto mb-0 flex font-aeonik')}>
				<div className={'size-full block min-h-max'}>
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
							</motion.div>
						</AnimatePresence>
					</LazyMotion>
				</div>
			</div>
		</>
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
	const {manifest} = useCurrentApp(props.router);

	return (
		<main className={cl(aeonik.className, 'h-full min-h-screen w-full font-aeonik', '')}>
			<WithMom
				supportedChains={[mainnet, optimism, polygon, fantom, base, arbitrum, localhost]}
				tokenLists={[
					'https://raw.githubusercontent.com/SmolDapp/tokenLists/main/lists/yearn.json',
					'https://raw.githubusercontent.com/SmolDapp/tokenLists/main/lists/portals.json'
				]}>
				<MenuContextApp>
					<YearnContextApp>
						<WalletForZapAppContextApp>
							<Fragment>
								<Meta meta={manifest} />
								<WithLayout {...props} />
							</Fragment>
						</WalletForZapAppContextApp>
					</YearnContextApp>
				</MenuContextApp>
			</WithMom>
			<Toaster
				toastOptions={{
					duration: 5000,
					className: 'toast',
					error: {
						icon: <IconAlertCritical className={'ml-3'} />,
						style: {
							backgroundColor: '#C73203',
							color: 'white'
						}
					},
					success: {
						icon: <IconCheckmark className={'ml-3'} />,
						style: {
							backgroundColor: '#00796D',
							color: 'white'
						}
					},
					icon: <IconAlertError className={'ml-3'} />,
					style: {
						backgroundColor: '#0657F9',
						color: 'white'
					}
				}}
				position={'bottom-right'}
			/>
		</main>
	);
}

export default MyApp;
