import React, {memo} from 'react';
import {Toaster} from 'react-hot-toast';
import {usePathname} from 'next/navigation';
import {useRouter} from 'next/router';
import PlausibleProvider from 'next-plausible';
import {AnimatePresence, domAnimation, LazyMotion, motion} from 'framer-motion';
import {WithMom} from '@builtbymom/web3/contexts/WithMom';
import {cl} from '@builtbymom/web3/utils';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {IconAlertCritical} from '@yearn-finance/web-lib/icons/IconAlertCritical';
import {IconAlertError} from '@yearn-finance/web-lib/icons/IconAlertError';
import {IconCheckmark} from '@yearn-finance/web-lib/icons/IconCheckmark';
import AppHeader from '@common/components/Header';
import {Meta} from '@common/components/Meta';
import {WithFonts} from '@common/components/WithFonts';
import {YearnContextApp} from '@common/contexts/useYearn';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';
import {SUPPORTED_NETWORKS} from '@common/utils/constants';

import type {AppProps} from 'next/app';
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
const WithLayout = memo(function WithLayout(props: {supportedNetworks: Chain[]} & AppProps): ReactElement {
	const router = useRouter();
	const {Component, pageProps} = props;
	const pathName = usePathname();
	const {name} = useCurrentApp(router);

	return (
		<>
			<div className={cl('mx-auto mb-0 flex font-aeonik max-w-6xl absolute top-0 inset-x-0')}>
				<AppHeader supportedNetworks={props.supportedNetworks} />
			</div>
			<div
				id={'app'}
				className={cl('mx-auto mb-0 flex font-aeonik')}>
				<div className={'block size-full min-h-max'}>
					<LazyMotion features={domAnimation}>
						<AnimatePresence mode={'wait'}>
							<motion.div
								key={`${name}_${pathName}`}
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
			<main className={cl('h-full min-h-screen w-full font-aeonik', '')}>
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
