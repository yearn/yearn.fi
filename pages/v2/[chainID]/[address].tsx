import {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useFetch} from '@builtbymom/web3/hooks/useFetch';
import {toAddress} from '@builtbymom/web3/utils';
import {VaultDetailsTabsWrapper} from '@vaults-v2/components/details/tabs/VaultDetailsTabsWrapper';
import {VaultActionsTabsWrapper} from '@vaults-v2/components/details/VaultActionsTabsWrapper';
import {ActionFlowContextApp} from '@vaults-v2/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults-v2/contexts/useSolver';
import {VaultDetailsHeader} from '@vaults-v3/components/details/VaultDetailsHeader';
import {useYDaemonBaseURI} from '@yearn-finance/web-lib/hooks/useYDaemonBaseURI';
import {yDaemonVaultSchema} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useYearn} from '@common/contexts/useYearn';
import {variants} from '@common/utils/animations';

import type {GetStaticPaths, GetStaticProps} from 'next';
import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TUseBalancesTokens} from '@builtbymom/web3/hooks/useBalances.multichains';

function Index(): ReactElement | null {
	const {address, isActive} = useWeb3();
	const router = useRouter();

	const {onRefresh} = useYearn();
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
			onRefresh(tokensToRefresh);
		}
	}, [currentVault?.address, currentVault?.token.address, address, isActive, onRefresh, currentVault?.chainID]);

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
		<div className={'mx-auto my-0 max-w-6xl pt-4 md:mb-0 md:mt-24'}>
			<header className={'pointer-events-none flex w-full items-center justify-center'}>
				<motion.div
					key={'Vaults'}
					initial={'initial'}
					animate={'enter'}
					variants={variants}
					className={'pointer-events-none -mt-16 size-12 cursor-pointer md:-mt-0 md:size-[72px]'}>
					<ImageWithFallback
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
