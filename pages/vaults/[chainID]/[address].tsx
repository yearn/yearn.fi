import {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import {VaultDetailsTabsWrapper} from '@vaults/components/details/tabs/VaultDetailsTabsWrapper';
import {VaultActionsTabsWrapper} from '@vaults/components/details/VaultActionsTabsWrapper';
import {VaultDetailsHeader} from '@vaults/components/details/VaultDetailsHeader';
import ActionFlowContextApp from '@vaults/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults/contexts/useSolver';
import Wrapper from '@vaults/Wrapper';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import TokenIcon from '@common/components/TokenIcon';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {useFetch} from '@common/hooks/useFetch';
import {type TYDaemonVault, yDaemonVaultSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {variants} from '@common/utils/animations';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {GetServerSideProps} from 'next';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

function Index(): ReactElement | null {
	const {address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {vaults} = useYearn();
	const router = useRouter();
	const {refresh} = useWallet();
	const {toast, toastMaster} = yToast();
	const [toastState, set_toastState] = useState<{id?: string; isOpen: boolean}>({isOpen: false});
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: Number(router.query.chainID)});
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
			const tokensToRefresh = [];
			if (currentVault?.address) {
				tokensToRefresh.push({token: toAddress(currentVault.address)});
			}
			if (currentVault?.token?.address) {
				tokensToRefresh.push({token: toAddress(currentVault.token.address)});
			}
			refresh(tokensToRefresh);
		}
	}, [currentVault?.address, currentVault?.token?.address, address, isActive, refresh]);

	useEffect((): void => {
		if (toastState.isOpen) {
			if (!!safeChainID && currentVault?.chainID === safeChainID) {
				toastMaster.dismiss(toastState.id);
				set_toastState({isOpen: false});
			}
			return;
		}

		if (!!safeChainID && currentVault?.chainID !== safeChainID) {
			const vaultChainName = getNetwork(currentVault?.chainID || 1)?.name || 'Unknown';
			const chainName = getNetwork(safeChainID)?.name || 'Unknown';

			const toastId = toast({
				type: 'warning',
				content: getToastMessage({vaultChainName, chainName}),
				duration: Infinity
			});

			set_toastState({id: toastId, isOpen: true});
		}
	}, [currentVault?.chainID, safeChainID, toast, toastMaster, toastState.id, toastState.isOpen]);

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
					<p className={'text-sm text-neutral-900'}>{'We couln\'t find this vault on the connected network.'}</p>
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
						chainID={currentVault?.chainID || safeChainID}
						token={currentVault?.token} />
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

export function getToastMessage({vaultChainName, chainName}: {vaultChainName?: string, chainName?: string}): string {
	if (vaultChainName && chainName) {
		return `Please note, this Vault is on ${vaultChainName}. You're currently connected to ${chainName}.`;
	}

	if (vaultChainName && !chainName) {
		return `Please note, this Vault is on ${vaultChainName} and you're currently connected to a different network.`;
	}

	if (!vaultChainName && chainName) {
		return `Please note, you're currently connected to ${chainName} and this Vault is on a different network.`;
	}

	return 'Please note, you\'re currently connected to a different network than this Vault.';
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return (
		<Wrapper router={router}>
			{page}
		</Wrapper>
	);
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getServerSideProps: GetServerSideProps = async () => {
	return {
		props: {}
	};

};

export default Index;
