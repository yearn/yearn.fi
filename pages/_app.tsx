import React, {Fragment, memo} from 'react';
import meta from 'public/manifest.json';
import {AnimatePresence, motion} from 'framer-motion';
import localFont from '@next/font/local';
import {WithYearn} from '@yearn-finance/web-lib/contexts/WithYearn';
import {AppHeader} from '@common/components/AppHeader';
import Meta from '@common/components/Meta';
import {FilterContextProvider} from '@common/contexts/FilterContext';
import {MenuContextApp} from '@common/contexts/useMenu';
import {WalletContextApp} from '@common/contexts/useWallet';
import {YearnContextApp} from '@common/contexts/useYearn';
import {variants} from '@common/utils/animations';

import type {AppProps} from 'next/app';
import type {ReactElement} from 'react';

import	'../style.css';

const aeonik = localFont({
	variable: '--font-aeonik',
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

const WithLayout = memo(function WithLayout(props: AppProps): ReactElement {
	const	{Component, pageProps, router} = props;
	const	getLayout = (Component as any).getLayout || ((page: ReactElement): ReactElement => page);

	return (
		<div id={'app'} className={'mx-auto mb-0 flex max-w-6xl font-aeonik'}>
			<div className={'block min-h-[100vh] w-full'}>
				<AppHeader />
				<AnimatePresence mode={'wait'}>
					<motion.div
						key={router.asPath}
						initial={'initial'}
						animate={'enter'}
						exit={'exit'}
						className={'my-0 h-full md:mb-0 md:mt-16'}
						variants={variants}>
						{getLayout(<Component router={props.router} {...pageProps} />)}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
});

const App = memo(function App(props: AppProps): ReactElement {
	const	{Component, pageProps} = props;
	
	return (
		<MenuContextApp>
			<YearnContextApp>
				<WalletContextApp>
					<FilterContextProvider>
						<Fragment>
							<Meta meta={meta} />
							<WithLayout
								Component={Component}
								pageProps={pageProps}
								router={props.router} />
						</Fragment>
					</FilterContextProvider>
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
