import React, {Fragment, memo} from 'react';
import PlausibleProvider from 'next-plausible';
import {AnimatePresence, domAnimation, LazyMotion, motion} from 'framer-motion';
import localFont from '@next/font/local';
import {WithYearn} from '@yearn-finance/web-lib/contexts/WithYearn';
import {AppHeader} from '@common/components/AppHeader';
import Meta from '@common/components/Meta';
import {MenuContextApp} from '@common/contexts/useMenu';
import {WalletContextApp} from '@common/contexts/useWallet';
import {YearnContextApp} from '@common/contexts/useYearn';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';

import type {NextComponentType} from 'next';
import type {AppProps} from 'next/app';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

import	'../style.css';

const aeonik = localFont({
	variable: '--font-aeonik',
	display: 'swap',
	src: [
		{
			path: '../public/fonts/Aeonik-Regular.woff2',
			weight: '400',
			style: 'normal'
		}, {
			path: '../public/fonts/Aeonik-Bold.woff2',
			weight: '700',
			style: 'normal'
		}
	]
});

type TGetLayout = NextComponentType & {getLayout: (p: ReactElement, router: NextRouter) => ReactElement}
const WithLayout = memo(function WithLayout(props: AppProps): ReactElement {
	const	{Component, pageProps, router} = props;
	const	getLayout = (Component as TGetLayout).getLayout || ((page: ReactElement): ReactElement => page);
	const	{name} = useCurrentApp(router);

	return (
		<PlausibleProvider
			domain={'yearn.finance'}
			customDomain={'https://analytics.yearn.finance'}
			selfHosted>
			<div id={'app'} className={'mx-auto mb-0 flex max-w-6xl font-aeonik'}>
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
								{getLayout(<Component router={props.router} {...pageProps} />, router)}
							</motion.div>
						</AnimatePresence>
					</LazyMotion>
				</div>
			</div>
		</PlausibleProvider>
	);
});

const App = memo(function App(props: AppProps): ReactElement {
	const	{Component, pageProps, router} = props;
	const	{manifest} = useCurrentApp(router);

	return (
		<MenuContextApp>
			<YearnContextApp>
				<WalletContextApp>
					<Fragment>
						<Meta meta={manifest} />
						<WithLayout
							Component={Component}
							pageProps={pageProps}
							router={props.router} />
					</Fragment>
				</WalletContextApp>
			</YearnContextApp>
		</MenuContextApp>
	);
});

function	MyApp(props: AppProps): ReactElement {
	return (
		<main className={aeonik.className}>
			<WithYearn
				options={{
					web3: {
						supportedChainID: [1, 10, 250, 42161, 1337]
					},
					baseSettings: {
						yDaemonBaseURI: process.env.YDAEMON_BASE_URI as string
					},
					ui: {
						shouldUseThemes: false
					}
				}}>
				<App {...props} />
			</WithYearn>
		</main>
	);
}

export default MyApp;
