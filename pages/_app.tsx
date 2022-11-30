import React from 'react';
import meta from 'public/manifest.json';
import {AnimatePresence, motion} from 'framer-motion';
import {WithYearn} from '@yearn-finance/web-lib/contexts';
import Header from '@common/components/Header';
import Meta from '@common/components/Meta';
import {WalletContextApp} from '@common/contexts/useWallet';
import {YearnContextApp} from '@common/contexts/useYearn';

import type {AppProps} from 'next/app';
import type {ReactElement} from 'react';

import	'../style.css';

const transition = {duration: 0.3, ease: [0.17, 0.67, 0.83, 0.67]};
const variants = {
	initial: {y: 20, opacity: 0},
	enter: {y: 0, opacity: 1, transition},
	exit: {y: -20, opacity: 0, transition}
};

function	WithLayout(props: AppProps): ReactElement {
	const	{Component, pageProps, router} = props;
	const	getLayout = (Component as any).getLayout || ((page: ReactElement): ReactElement => page);

	return (
		<div id={'app'} className={'mx-auto mb-0 flex max-w-6xl'}>
			<div className={'block min-h-[100vh] w-full'}>
				<Header />
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
}

function	MyApp(props: AppProps): ReactElement {
	const	{Component, pageProps} = props;
	
	return (
		<WithYearn
			options={{
				baseSettings: {
					yDaemonBaseURI: process.env.YDAEMON_BASE_URI as string
				},
				ui: {
					shouldUseThemes: false
				}
			}}>
			<YearnContextApp>
				<WalletContextApp>
					<>
						<Meta meta={meta} />
						<WithLayout
							Component={Component}
							pageProps={pageProps}
							router={props.router} />
					</>
				</WalletContextApp>
			</YearnContextApp>
		</WithYearn>
	);
}

export default MyApp;
