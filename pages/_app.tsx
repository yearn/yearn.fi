import React, {memo} from 'react';
import {Toaster} from 'react-hot-toast';
import {usePathname} from 'next/navigation';
import PlausibleProvider from 'next-plausible';
import {LandingAppHeader} from 'apps/landing/components/common/Header';
import {AnimatePresence, domAnimation, LazyMotion, motion} from 'framer-motion';
import {WithMom} from '@builtbymom/web3/contexts/WithMom';
import {cl} from '@builtbymom/web3/utils';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {IconAlertCritical} from '@yearn-finance/web-lib/icons/IconAlertCritical';
import {IconAlertError} from '@yearn-finance/web-lib/icons/IconAlertError';
import {IconCheckmark} from '@yearn-finance/web-lib/icons/IconCheckmark';
import AppHeader from '@common/components/Header';
import {Meta} from '@common/components/Meta';
// import {MobileNavbar} from '@common/components/MobileNavbar';
// import {MobileTopNav} from '@common/components/MobileTopNav';
import {WithFonts} from '@common/components/WithFonts';
import {YearnContextApp} from '@common/contexts/useYearn';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';
import {SUPPORTED_NETWORKS} from '@common/utils/constants';

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
	const {name} = useCurrentApp(props.router);
	const isVaultsPage = props.router.asPath?.startsWith('/vaults');
	const pathName = usePathname();

	if (isVaultsPage) {
		return (
			<>
				<div className={cl('mx-auto mb-0 flex z-[60] font-aeonik max-w-6xl absolute top-0 inset-x-0')}>
					<AppHeader supportedNetworks={props.supportedNetworks} />
				</div>
				<div
					id={'app'}
					className={'relative mb-0 flex min-h-screen justify-center font-aeonik'}>
					<div
						className={'absolute left-0 top-0 h-[200px] w-full bg-gradient-to-b from-blue-900 to-neutral-0'}
					/>
					<div className={'flex w-full max-w-[1230px] justify-start'}>
						<LazyMotion features={domAnimation}>
							<AnimatePresence mode={'wait'}>
								<motion.div
									key={`${props.router.asPath}-${props.router.query.query}`}
									initial={'initial'}
									animate={'enter'}
									exit={'exit'}
									variants={variants}
									className={cl(
										// 'w-full overflow-x-hidden md:ml-[305px]',
										'w-full overflow-x-hidden md:mt-[64px]'
									)}>
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
								key={`${name}_${props.router.asPath}`}
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
								<WithLayout
									supportedNetworks={SUPPORTED_NETWORKS}
									{...props}
								/>
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
