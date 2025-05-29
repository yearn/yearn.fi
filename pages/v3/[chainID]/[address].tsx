import {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useFetch} from '@builtbymom/web3/hooks/useFetch';
import {cl, toAddress} from '@builtbymom/web3/utils';
import {ActionFlowContextApp} from '@vaults/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults/contexts/useSolver';
import {VaultActionsTabsWrapper} from '@vaults-v3/components/details/VaultActionsTabsWrapper';
import {VaultDetailsHeader} from '@vaults-v3/components/details/VaultDetailsHeader';
import {VaultDetailsTabsWrapper} from '@vaults-v3/components/details/VaultDetailsTabsWrapper';
import {useYDaemonBaseURI} from '@yearn-finance/web-lib/hooks/useYDaemonBaseURI';
import {yDaemonVaultSchema} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useYearn} from '@common/contexts/useYearn';

import type {GetStaticPaths, GetStaticProps} from 'next';
import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TUseBalancesTokens} from '@builtbymom/web3/hooks/useBalances.multichains';

function Index(): ReactElement | null {
	const router = useRouter();
	const [currentVault, set_currentVault] = useState<TYDaemonVault | undefined>(undefined);
	const [isInit, set_isInit] = useState(false);
	const [hasError, set_hasError] = useState(false);
	const [isClient, set_isClient] = useState(false);

	// Always call hooks, but conditionally use their values
	const Web3Context = useWeb3();
	const YearnContext = useYearn();

	// Ensure we're on the client side before using client-side values
	useEffect(() => {
		set_isClient(true);
	}, []);

	// Safe access to context values
	const address = isClient ? Web3Context.address : undefined;
	const isActive = isClient ? Web3Context.isActive : false;
	const onRefresh = isClient ? YearnContext.onRefresh : () => {};

	// Safe chainID parsing with fallback
	const chainID = router.query.chainID ? Number(router.query.chainID) : 1;
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID});

	const {
		data: vault,
		isLoading: isLoadingVault,
		error
	} = useFetch<TYDaemonVault>({
		endpoint:
			router.query.address && isClient
				? `${yDaemonBaseUri}/vaults/${toAddress(router.query.address as string)}?${new URLSearchParams({
						strategiesDetails: 'withDetails',
						strategiesCondition: 'inQueue'
					})}`
				: null,
		schema: yDaemonVaultSchema
	});

	// Handle any errors that might occur during data fetching
	useEffect((): void => {
		if (error) {
			console.error('Error loading vault data:', error);
			set_hasError(true);
		}
	}, [error]);

	useEffect((): void => {
		if (vault && !currentVault) {
			set_currentVault(vault);
			set_isInit(true);
			set_hasError(false);
		}
	}, [currentVault, vault]);

	useEffect((): void => {
		if (address && isActive && isClient) {
			const tokensToRefresh: TUseBalancesTokens[] = [];
			if (currentVault?.address) {
				tokensToRefresh.push({address: currentVault.address, chainID: currentVault.chainID});
			}
			if (currentVault?.token?.address) {
				tokensToRefresh.push({address: currentVault.token.address, chainID: currentVault.chainID});
			}
			onRefresh(tokensToRefresh);
		}
	}, [
		currentVault?.address,
		currentVault?.token?.address,
		address,
		isActive,
		onRefresh,
		currentVault?.chainID,
		isClient
	]);

	// Show loading state during SSR and initial client hydration
	if (!isClient || !router.isReady) {
		return (
			<div className={'relative flex min-h-dvh flex-col px-4 text-center'}>
				<div className={'mt-[20%] flex h-10 items-center justify-center'}>
					<span className={'loader'} />
				</div>
			</div>
		);
	}

	// Show error state if there's an error
	if (hasError) {
		return (
			<div className={'relative flex min-h-dvh flex-col px-4 text-center'}>
				<div className={'mt-[20%] flex flex-col items-center justify-center'}>
					<p className={'mb-4 text-lg text-neutral-900'}>{'Unable to load vault data'}</p>
					<button
						onClick={() => {
							set_hasError(false);
							router.reload();
						}}
						className={
							'rounded-lg bg-neutral-900 px-4 py-2 text-white transition-colors hover:bg-neutral-700'
						}>
						{'Try Again'}
					</button>
				</div>
			</div>
		);
	}

	if (isLoadingVault || !router.query.address || !isInit) {
		return (
			<div className={'relative flex min-h-dvh flex-col px-4 text-center'}>
				<div className={'mt-[20%] flex h-10 items-center justify-center'}>
					<span className={'loader'} />
				</div>
			</div>
		);
	}

	if (!currentVault) {
		return (
			<div className={'relative flex h-14 flex-col items-center justify-center px-4 text-center'}>
				<div className={'mt-[20%] flex h-10 items-center justify-center'}>
					<p className={'text-sm text-neutral-900'}>
						{"We couln't find this vault on the connected network."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className={'mx-auto w-full max-w-6xl pt-20 md:pt-32'}>
			<nav className={`mb-4 self-start md:mb-2 md:hidden`}>
				<button
					className={'z-50 w-fit'}
					onClick={() => router.back()}>
					<p
						className={
							'flex w-fit text-xs text-neutral-900/70 transition-colors hover:text-neutral-900 md:text-base'
						}>
						<span className={'pr-2 leading-[normal]'}>&#10229;</span>
						{'  Back'}
					</p>
				</button>
			</nav>
			<header
				className={cl(
					'h-full rounded-3xl',
					'pt-6 pb-6 md:pb-10 px-4 md:px-8',
					'bg-[linear-gradient(73deg,_#D21162_24.91%,_#2C3DA6_99.66%)]',
					'relative flex flex-col items-center justify-center'
				)}>
				<nav className={`mb-4 hidden self-start md:mb-2 md:block`}>
					<button
						className={'w-fit'}
						onClick={() => router.back()}>
						<p
							className={
								'flex w-fit text-xs text-neutral-900/70 transition-colors hover:text-neutral-900 md:text-base'
							}>
							<span className={'pr-2 leading-[normal]'}>&#10229;</span>
							{'  Back'}
						</p>
					</button>
				</nav>
				<div className={'absolute -top-10 md:-top-6'}>
					<div
						className={cl(
							'h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-[#FAD1ED7A] backdrop-blur',
							'flex justify-center items-center'
						)}>
						<ImageWithFallback
							className={'size-10 md:size-12'}
							src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
							alt={''}
							width={48}
							height={48}
						/>
					</div>
				</div>
				<VaultDetailsHeader currentVault={currentVault} />
			</header>

			<section className={'mt-4 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<ActionFlowContextApp currentVault={currentVault}>
					<WithSolverContextApp>
						<VaultActionsTabsWrapper currentVault={currentVault} />
					</WithSolverContextApp>
				</ActionFlowContextApp>
				<VaultDetailsTabsWrapper currentVault={currentVault} />
			</section>
		</div>
	);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getStaticPaths = (async () => {
	return {
		paths: [],
		fallback: true
	};
}) satisfies GetStaticPaths;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getStaticProps: GetStaticProps = async context => {
	try {
		// Validate that we have the required parameters
		const {chainID, address} = context.params || {};

		if (!chainID || !address) {
			return {
				notFound: true
			};
		}

		// Validate chainID is a number
		const parsedChainID = Number(chainID);
		if (isNaN(parsedChainID)) {
			return {
				notFound: true
			};
		}

		// Return empty props - data will be fetched client-side
		return {
			props: {
				chainID: parsedChainID,
				address: address as string
			},
			// Revalidate every 5 minutes
			revalidate: 300
		};
	} catch (error) {
		console.error('Error in getStaticProps:', error);
		return {
			props: {},
			// Retry after 1 minute if there's an error
			revalidate: 60
		};
	}
};

export default Index;
