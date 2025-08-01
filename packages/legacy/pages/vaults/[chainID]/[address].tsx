import {ImageWithFallback} from '@lib/components/ImageWithFallback';
import {useWallet} from '@lib/contexts/useWallet';
import {useWeb3} from '@lib/contexts/useWeb3';
import type {TUseBalancesTokens} from '@lib/hooks/useBalances.multichains';
import {useFetch} from '@lib/hooks/useFetch';
import {useYDaemonBaseURI} from '@lib/hooks/useYDaemonBaseURI';
import {toAddress} from '@lib/utils';
import {variants} from '@lib/utils/animations';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import {yDaemonVaultSchema} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import {VaultDetailsTabsWrapper} from '@vaults-v2/components/details/tabs/VaultDetailsTabsWrapper';
import {VaultActionsTabsWrapper} from '@vaults-v2/components/details/VaultActionsTabsWrapper';
import {ActionFlowContextApp} from '@vaults-v2/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults-v2/contexts/useSolver';
import {VaultDetailsHeader} from '@vaults-v3/components/details/VaultDetailsHeader';
import {motion} from 'framer-motion';

import type {GetStaticPaths, GetStaticProps} from 'next';
import {useRouter} from 'next/router';
import type {ReactElement} from 'react';
import {useEffect, useState} from 'react';

function Index(): ReactElement | null {
	const {address, isActive} = useWeb3();
	const router = useRouter();

	const {onRefresh} = useWallet();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: Number(router.query.chainID)});
	const [currentVault, set_currentVault] = useState<TYDaemonVault | undefined>(undefined);
	const {data: vault, isLoading: isLoadingVault} = useFetch<TYDaemonVault>({
		endpoint: router.query.address
			? `${yDaemonBaseUri}/vaults/${toAddress(router.query.address as string)}?${new URLSearchParams({
					strategiesDetails: 'withDetails',
					strategiesCondition: 'inQueue'
				})}`
			: null,
		schema: yDaemonVaultSchema
	});

	useEffect((): void => {
		if (vault && !currentVault) {
			set_currentVault(vault);
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

	if (isLoadingVault || !router.query.address) {
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
		<div className={'mx-auto my-0 mt-24 max-w-6xl md:mb-0'}>
			<header className={'pointer-events-none flex w-full items-center justify-center'}>
				<motion.div
					key={'Vaults'}
					initial={'initial'}
					animate={'enter'}
					variants={variants}
					className={'pointer-events-none cursor-pointer md:-mt-0 '}
				>
					<ImageWithFallback
						className={'size-12 md:size-[72px]'}
						src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${toAddress(
							currentVault.token.address
						)}/logo-128.png`}
						alt={''}
						width={72}
						height={72}
					/>
				</motion.div>
			</header>

			<section className={'mt-4 grid w-full grid-cols-12 pb-10 md:mt-10'}>
				<VaultDetailsHeader currentVault={currentVault} />
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

export const getStaticPaths = (async () => {
	return {
		paths: [],
		fallback: true
	};
}) satisfies GetStaticPaths;

export const getStaticProps: GetStaticProps = async () => {
	return {
		props: {}
	};
};

export default Index;
