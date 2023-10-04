import {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import {VaultDetailsTabsWrapper} from '@vaults/components/details/tabs/VaultDetailsTabsWrapper';
import {VaultActionsTabsWrapper} from '@vaults/components/details/VaultActionsTabsWrapper';
import {VaultDetailsHeader} from '@vaults/components/details/VaultDetailsHeader';
import {ActionFlowContextApp} from '@vaults/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults/contexts/useSolver';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import TokenIcon from '@common/components/TokenIcon';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {useFetch} from '@common/hooks/useFetch';
import {type TYDaemonVault, yDaemonVaultSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {variants} from '@common/utils/animations';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {GetServerSideProps} from 'next';
import type {ReactElement} from 'react';
import type {TUseBalancesTokens} from '@common/hooks/useMultichainBalances';

function Index(): ReactElement | null {
	const {address, isActive} = useWeb3();
	const {vaults} = useYearn();
	const router = useRouter();
	const {refresh} = useWallet();
	const {yDaemonBaseUri} = useYDaemonBaseURI({
		chainID: Number(router.query.chainID)
	});
	const [currentVault, set_currentVault] = useState<TYDaemonVault | undefined>(vaults[toAddress(router.query.address as string)]);
	const {data: vault, isLoading: isLoadingVault} = useFetch<TYDaemonVault>({
		endpoint: `${yDaemonBaseUri}/vaults/${toAddress(router.query.address as string)}?${new URLSearchParams({
			strategiesDetails: 'withDetails',
			strategiesRisk: 'withRisk',
			strategiesCondition: 'inQueue'
		})}`,
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
	}, [currentVault?.address, currentVault?.token?.address, address, isActive, refresh]);

	if (isLoadingVault) {
		return (
			<div className={'relative flex h-14 flex-col items-center justify-center px-4 text-center'}>
				<div className={'flex h-10 items-center justify-center'}>
					<span className={'loader'} />
				</div>
			</div>
		);
	}

	if (!currentVault) {
		return (
			<div className={'relative flex h-14 flex-col items-center justify-center px-4 text-center'}>
				<div className={'flex h-10 items-center justify-center'}>
					<p className={'text-sm text-neutral-900'}>{"We couln't find this vault on the connected network."}</p>
				</div>
			</div>
		);
	}

	return (
		<>
			<header className={'relative z-50 flex w-full items-center justify-center'}>
				<motion.div
					key={'vaults'}
					initial={'initial'}
					animate={'enter'}
					variants={variants}
					className={'z-50 -mt-6 h-12 w-12 cursor-pointer md:-mt-36 md:h-[72px] md:w-[72px]'}>
					<TokenIcon
						chainID={currentVault.chainID}
						token={currentVault.token}
					/>
				</motion.div>
			</header>

			<section className={'mt-4 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<VaultDetailsHeader vault={currentVault} />
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
export const getServerSideProps: GetServerSideProps = async () => {
	return {
		props: {}
	};
};

export default Index;
