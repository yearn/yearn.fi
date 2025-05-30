import React, {memo, useState} from 'react';
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
import {MobileNavbar} from '@common/components/MobileNavbar';
import {MobileTopNav} from '@common/components/MobileTopNav';
import {Sidebar} from '@common/components/Sidebar';
import {WithFonts} from '@common/components/WithFonts';
import {SearchContextApp} from '@common/contexts/useSearch';
import {YearnContextApp} from '@common/contexts/useYearn';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';
import {MENU_TABS, SUPPORTED_NETWORKS} from '@common/utils/constants';

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
	const [isSearchOpen, set_isSearchOpen] = useState(false);
	const [isNavbarOpen, set_isNavbarOpen] = useState(false);
	const isAppsPage = props.router.asPath?.startsWith('/apps');
	const pathName = usePathname();

	if (isAppsPage) {
		return (
			<SearchContextApp>
				<div
					id={'app'}
					className={'mb-0 flex min-h-screen justify-center bg-gray-900 font-aeonik'}>
					<div className={'flex w-full max-w-[1230px] justify-start'}>
						<motion.nav className={'fixed z-50 w-full md:hidden'}>
							<MobileTopNav
								isNavbarOpen={isNavbarOpen}
								isSearchOpen={isSearchOpen}
								set_isSearchOpen={set_isSearchOpen}
								set_isNavbarOpen={set_isNavbarOpen}
							/>
						</motion.nav>
						{isNavbarOpen && (
							<motion.nav
								className={'sticky top-16 z-50 h-[calc(100vh-64px)] w-screen md:hidden'}
								initial={{y: '100%'}} // Start from below the screen
								animate={{y: 0}} // Animate to the original position
								exit={{y: '100%'}} // Exit back to below the screen
								transition={{type: 'tween', stiffness: 300, damping: 30}} // Add transition for smooth animation
							>
								<MobileNavbar
									onClose={() => {
										set_isNavbarOpen(false);
										set_isSearchOpen(false);
									}}
								/>
							</motion.nav>
						)}
						<motion.nav className={'top-0 z-20 hidden h-screen py-4 pl-4 md:fixed md:block'}>
							<Sidebar tabs={MENU_TABS} />
						</motion.nav>
						<LazyMotion features={domAnimation}>
							<AnimatePresence mode={'wait'}>
								<motion.div
									key={`${props.router.asPath}-${props.router.query.query}`}
									initial={'initial'}
									animate={'enter'}
									exit={'exit'}
									variants={variants}
									className={cl(
										'w-full overflow-x-hidden md:ml-[305px]',
										isSearchOpen ? 'mt-16' : ''
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
			</SearchContextApp>
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

	// Global error handler for Vercel preview and other external script errors
	React.useEffect(() => {
		const handleError = (event: ErrorEvent): boolean => {
			// Suppress Vercel preview feedback system errors
			if (
				event.message?.includes('previewOrigin not set yet') ||
				event.message?.includes('Failed to load static props') ||
				event.filename?.includes('feedback.html')
			) {
				console.warn('Vercel preview system error suppressed:', event.message);
				event.preventDefault();
				return false;
			}
			return true;
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
			// Suppress promise rejections related to Vercel preview system
			if (
				event.reason?.message?.includes('previewOrigin not set yet') ||
				event.reason?.message?.includes('Failed to load static props')
			) {
				console.warn('Vercel preview promise rejection suppressed:', event.reason);
				event.preventDefault();
			}
		};

		window.addEventListener('error', handleError);
		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			window.removeEventListener('error', handleError);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		};
	}, []);

	return (
		<ErrorBoundary>
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
		</ErrorBoundary>
	);
}

/************************************************************************************************
 ** ErrorBoundary component to catch and handle JavaScript errors gracefully, including those
 ** from external scripts like Vercel's feedback system that might interfere with the app.
 ************************************************************************************************/
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error?: Error}> {
	constructor(props: {children: React.ReactNode}) {
		super(props);
		this.state = {hasError: false};
	}

	static getDerivedStateFromError(error: Error): {hasError: boolean; error: Error} {
		return {hasError: true, error};
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		// Log error but don't let it crash the app
		console.error('Application error caught by boundary:', error, errorInfo);

		// Suppress specific Vercel preview errors
		if (
			error.message?.includes('previewOrigin not set yet') ||
			error.message?.includes('Failed to load static props')
		) {
			console.warn('Vercel preview system error suppressed:', error.message);
		}
	}

	render(): React.ReactNode {
		if (this.state.hasError) {
			// Don't show error UI for Vercel preview errors, just log and continue
			if (
				this.state.error?.message?.includes('previewOrigin not set yet') ||
				this.state.error?.message?.includes('Failed to load static props')
			) {
				// Reset error state and continue rendering
				this.setState({hasError: false, error: undefined});
				return this.props.children;
			}

			return (
				<div className={'flex min-h-screen items-center justify-center bg-neutral-100'}>
					<div className={'text-center'}>
						<h2 className={'mb-4 text-xl font-bold text-neutral-900'}>{'Something went wrong'}</h2>
						<button
							onClick={() => this.setState({hasError: false})}
							className={
								'rounded-lg bg-neutral-900 px-4 py-2 text-white transition-colors hover:bg-neutral-700'
							}>
							{'Try again'}
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default MyApp;
