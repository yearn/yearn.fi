import React, {memo} from 'react';
import {Toaster} from 'react-hot-toast';
import {usePathname} from 'next/navigation';
import PlausibleProvider from 'next-plausible';
import {LandingAppHeader} from 'apps/landing/components/common/Header';
import {AnimatePresence, domAnimation, LazyMotion, motion} from 'framer-motion';
import {AppSettingsContextApp} from '@vaults-v2/contexts/useAppSettings';
import AppHeader from '@lib/components/Header';
import {Meta} from '@lib/components/Meta';
import {WithFonts} from '@lib/components/WithFonts';
import {WalletContextApp} from '@lib/contexts/useWallet';
import {YearnContextApp} from '@lib/contexts/useYearn';
import {WithMom} from '@lib/contexts/WithMom';
import {useCurrentApp} from '@lib/hooks/useCurrentApp';
import {IconAlertCritical} from '@lib/icons/IconAlertCritical';
import {IconAlertError} from '@lib/icons/IconAlertError';
import {IconCheckmark} from '@lib/icons/IconCheckmark';
import {cl} from '@lib/utils';
import {variants} from '@lib/utils/animations';
import {SUPPORTED_NETWORKS} from '@lib/utils/constants';

import type {AppProps} from 'next/app';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {Chain} from 'viem';

import '../style.css';

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
const WithLayout = memo(function WithLayout(
	props: {router: NextRouter; supportedNetworks: Chain[]} & AppProps
): ReactElement {
	const {Component, pageProps} = props;
	const isAppsPage = props.router.asPath?.startsWith('/apps');
	const pathName = usePathname();

	if (isAppsPage) {
		return (
			<>
				<div
					className={cl(
						'mx-auto mb-0 flex z-[60] font-aeonik max-w-6xl absolute top-0 inset-x-0 bg-neutral-0'
					)}>
					<AppHeader supportedNetworks={props.supportedNetworks} />
				</div>
				<div
					id={'app'}
					className={'mb-0 flex min-h-screen justify-center bg-neutral-0 font-aeonik'}>
					<div className={'flex w-full max-w-[1230px] justify-start'}>
						<Component
							router={props.router}
							{...pageProps}
						/>
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<div className={cl('mx-auto mb-0 flex z-[60] font-aeonik max-w-6xl absolute top-0 inset-x-0')}>
				{pathName === '/' ? <LandingAppHeader /> : <AppHeader supportedNetworks={props.supportedNetworks} />}
			</div>
			<div
				id={'app'}
				className={cl('mx-auto mb-0 flex font-aeonik')}>
				<div className={'block size-full min-h-max'}>
					<LazyMotion features={domAnimation}>
						<AnimatePresence mode={'wait'}>
							<motion.div
								key={props.router.asPath}
								initial={'initial'}
								animate={'enter'}
								exit={'exit'}
								variants={variants}>
								<Component
									router={props.router}
									{...pageProps}
								/>
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
		<WithFonts>
			<Meta
				title={manifest.name || 'Yearn'}
				description={manifest.description || 'The yield protocol for digital assets'}
				titleColor={'#ffffff'}
				themeColor={'#000000'}
				og={manifest.og || 'https://yearn.fi/og.png'}
				uri={manifest.uri || 'https://yearn.fi'}
			/>
			<main className={'size-full min-h-screen font-aeonik'}>
				<PlausibleProvider
					domain={'yearn.fi'}
					enabled={true}>
					<WithMom
						supportedChains={SUPPORTED_NETWORKS}
						tokenLists={[
							'https://raw.githubusercontent.com/SmolDapp/tokenLists/main/lists/yearn.json',
							'https://raw.githubusercontent.com/SmolDapp/tokenLists/main/lists/popular.json'
						]}>
						<AppSettingsContextApp>
							<YearnContextApp>
								<WalletContextApp>
									<WithLayout
										supportedNetworks={SUPPORTED_NETWORKS}
										{...props}
									/>
								</WalletContextApp>
							</YearnContextApp>
						</AppSettingsContextApp>
					</WithMom>
				</PlausibleProvider>
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
		</WithFonts>
	);
}

export default MyApp;
