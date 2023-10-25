import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {VaultDetailsTabsWrapper} from '@vaults/components/details/tabs/VaultDetailsTabsWrapper';
import {VaultActionsTabsWrapper} from '@vaults/components/details/VaultActionsTabsWrapper';
import {VaultDetailsHeader} from '@vaults/components/details/VaultDetailsHeader';
import {ActionFlowContextApp} from '@vaults/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults/contexts/useSolver';
import {Wrapper} from '@vaults/Wrapper';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import TokenIcon from '@common/components/TokenIcon';
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
	}, [currentVault?.address, currentVault?.token.address, address, isActive, refresh, currentVault?.chainID]);

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
				<div className={'flex h-10 items-center justify-center'}>
					<p className={'text-sm text-neutral-900'}>
						{"We couln't find this vault on the connected network."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<>
			<header
				className={cl(
					'h-full rounded-3xl',
					'pt-6 pb-10 px-8',
					'bg-[linear-gradient(73deg,_#D21162_24.91%,_#2C3DA6_99.66%)]',
					'relative flex flex-col items-center justify-center'
				)}>
				<nav className={`mb-2 w-full`}>
					<Link href={'/vaults-v3'}>
						<p className={'flex text-neutral-900/70'}>
							<span className={'pr-2 leading-[normal]'}>&#10229;</span>
							{'  Back to vaults'}
						</p>
					</Link>
				</nav>
				<TokenIcon
					chainID={currentVault.chainID}
					token={currentVault.token}
				/>
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
		</>
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
