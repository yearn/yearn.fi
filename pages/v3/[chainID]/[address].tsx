import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {ActionFlowContextApp} from '@vaults/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults/contexts/useSolver';
import {VaultActionsTabsWrapper} from '@vaults-v3/components/details/VaultActionsTabsWrapper';
import {VaultDetailsHeader} from '@vaults-v3/components/details/VaultDetailsHeader';
import {VaultDetailsTabsWrapper} from '@vaults-v3/components/details/VaultDetailsTabsWrapper';
import {Wrapper} from '@vaults-v3/Wrapper';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useWallet} from '@common/contexts/useWallet';
import {useFetch} from '@common/hooks/useFetch';
import {type TYDaemonVault, yDaemonVaultSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {GetStaticPaths, GetStaticProps} from 'next';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TUseBalancesTokens} from '@common/hooks/useMultichainBalances';

function Index(): ReactElement | null {
	const {address, isActive} = useWeb3();
	const router = useRouter();
	const {refresh} = useWallet();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: Number(router.query.chainID)});
	const [currentVault, set_currentVault] = useState<TYDaemonVault | undefined>(undefined);
	const {data: vault, isLoading: isLoadingVault} = useFetch<TYDaemonVault>({
		endpoint: router.query.address
			? `${yDaemonBaseUri}/vaults/${toAddress(router.query.address as string)}?${new URLSearchParams({
					strategiesDetails: 'withDetails',
					strategiesRisk: 'withRisk',
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
			refresh(tokensToRefresh);
		}
	}, [currentVault?.address, currentVault?.token?.address, address, isActive, refresh, currentVault?.chainID]);

	if (isLoadingVault || !router.query.address) {
		return (
			<div className={'relative flex min-h-[100dvh] flex-col px-4 text-center'}>
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
				<Link
					href={'/v3'}
					className={'z-50 w-fit'}>
					<p
						className={
							'flex w-fit text-xs text-neutral-900/70 transition-colors hover:text-neutral-900 md:text-base'
						}>
						<span className={'pr-2 leading-[normal]'}>&#10229;</span>
						{'  Back to vaults'}
					</p>
				</Link>
			</nav>
			<header
				className={cl(
					'h-full rounded-3xl',
					'pt-6 pb-6 md:pb-10 px-4 md:px-8',
					'bg-[linear-gradient(73deg,_#D21162_24.91%,_#2C3DA6_99.66%)]',
					'relative flex flex-col items-center justify-center'
				)}>
				<nav className={`mb-4 hidden self-start md:mb-2 md:block`}>
					<Link
						href={'/v3'}
						className={'w-fit'}>
						<p
							className={
								'flex w-fit text-xs text-neutral-900/70 transition-colors hover:text-neutral-900 md:text-base'
							}>
							<span className={'pr-2 leading-[normal]'}>&#10229;</span>
							{'  Back to vaults'}
						</p>
					</Link>
				</nav>
				<div className={'absolute -top-10 md:-top-6'}>
					<div
						className={cl(
							'h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-[#FAD1ED7A] backdrop-blur',
							'flex justify-center items-center'
						)}>
						<ImageWithFallback
							className={'h-10 w-10 md:h-12 md:w-12'}
							src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
							alt={''}
							smWidth={40}
							smHeight={40}
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

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
