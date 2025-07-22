import {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {ActionFlowContextApp} from '@vaults-v2/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults-v2/contexts/useSolver';
import {VaultActionsTabsWrapper} from '@vaults-v3/components/details/VaultActionsTabsWrapper';
import {VaultDetailsHeader} from '@vaults-v3/components/details/VaultDetailsHeader';
import {VaultDetailsTabsWrapper} from '@vaults-v3/components/details/VaultDetailsTabsWrapper';
import {ImageWithFallback} from '@lib/components/ImageWithFallback';
import {useWallet} from '@lib/contexts/useWallet';
import {useWeb3} from '@lib/contexts/useWeb3';
import {useFetchYearnVaults} from '@lib/hooks/useFetchYearnVaults';
import {cl, toAddress} from '@lib/utils';

import type {GetStaticPaths, GetStaticProps} from 'next';
import type {ReactElement} from 'react';
import type {TUseBalancesTokens} from '@lib/hooks/useBalances.multichains';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';

function Index(): ReactElement | null {
	const {address, isActive} = useWeb3();
	const router = useRouter();
	const {onRefresh} = useWallet();
	// const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: Number(router.query.chainID)});
	const [currentVault, set_currentVault] = useState<TYDaemonVault | undefined>(undefined);
	const [isInit, set_isInit] = useState(false);
	const {vaults, isLoading: isLoadingVault} = useFetchYearnVaults();
	const currentVaultAddress = toAddress(router.query.address as string);
	const vault = vaults[currentVaultAddress];

	useEffect((): void => {
		if (vault && !currentVault) {
			console.log('set currentVault');
			set_currentVault(vault);
			set_isInit(true);
		}
	}, [currentVault, vault]);

	useEffect((): void => {
		if (address && isActive) {
			const tokensToRefresh: TUseBalancesTokens[] = [];
			if (currentVault?.address) {
				tokensToRefresh.push({address: currentVault.address, chainID: currentVault.chainID});
			}
			if (currentVault?.token?.address) {
				tokensToRefresh.push({address: currentVault.token.address, chainID: currentVault.chainID});
			}
			if (currentVault?.staking.available) {
				tokensToRefresh.push({address: currentVault.staking.address, chainID: currentVault.chainID});
			}
			onRefresh(tokensToRefresh);
		}
	}, [
		currentVault?.address,
		currentVault?.token.address,
		address,
		isActive,
		onRefresh,
		currentVault?.chainID,
		currentVault?.staking.available,
		currentVault?.staking.address
	]);

	if (isLoadingVault || !isInit) {
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
						{"We couldn't find this vault on the connected network."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className={'mx-auto w-full max-w-6xl pt-20 md:pt-32'}>
			{/* Mobile Back Button */}
			<nav className={'mb-4 self-start md:mb-2 md:hidden'}>
				<button
					className={'z-50 w-fit'}
					onClick={async () => await router.push('/v3')}>
					<p
						className={
							'flex w-fit text-xs text-neutral-900/70 transition-colors hover:text-neutral-900 md:text-base'
						}>
						<span className={'pr-2 leading-[normal]'}>&#10229;</span>
						{'  Back'}
					</p>
				</button>
			</nav>
			{/* Header with gradient background and vault logo */}
			<header
				className={cl(
					'h-full rounded-3xl',
					'pt-6 pb-6 md:pb-10 px-4 md:px-8',
					'bg-[linear-gradient(73deg,_#D21162_24.91%,_#2C3DA6_99.66%)]',
					'relative flex flex-col items-center justify-center'
				)}>
				<nav className={'mb-4 hidden self-start md:mb-2 md:block'}>
					<button
						className={'w-fit'}
						onClick={async () => await router.push('/v3')}>
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
export const getStaticProps: GetStaticProps = async () => {
	return {
		props: {}
	};
};

export default Index;
