import React, {useEffect, useRef, useState} from 'react';
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
import CHAINS from '@yearn-finance/web-lib/utils/web3/chains';
import TokenIcon from '@common/components/TokenIcon';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {variants} from '@common/utils/animations';

import type {NextPageContext} from 'next';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TYearnVault} from '@common/types/yearn';

function Index({router, vaultData}: {router: NextRouter, vaultData: TYearnVault}): ReactElement {
	const {address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {vaults} = useYearn();
	const {refresh} = useWallet();
	const {toast, toastMaster} = yToast();
	
	const [toastState, set_toastState] = useState<{id?: string; isOpen: boolean}>({isOpen: false});
	const currentVault = useRef<TYearnVault>(vaults[toAddress(router.query.address as string)] as TYearnVault || vaultData);

	useEffect((): void => {
		if (address && isActive) {
			const	tokensToRefresh = [];
			if (currentVault?.current?.address) {
				tokensToRefresh.push({token: toAddress(currentVault.current.address)});
			}
			if (currentVault?.current?.token?.address) {
				tokensToRefresh.push({token: toAddress(currentVault.current.token.address)});
			}
			refresh(tokensToRefresh);
		}
	}, [currentVault.current?.address, currentVault.current?.token?.address, address, isActive, refresh]);

	useEffect((): void => {
		if (toastState.isOpen) {
			if (!!safeChainID && currentVault.current?.chainID === safeChainID) {
				toastMaster.dismiss(toastState.id);
				set_toastState({isOpen: false});
			}
			return;
		}

		if (!!safeChainID && currentVault.current?.chainID !== safeChainID) {
			const vaultChainName = CHAINS[currentVault.current?.chainID]?.name;
			const chainName = CHAINS[safeChainID]?.name;

			const toastId = toast({
				type: 'warning',
				content: getToastMessage({vaultChainName, chainName}),
				duration: Infinity
			});

			set_toastState({id: toastId, isOpen: true});
		}
	}, [safeChainID, toast, toastMaster, toastState.id, toastState.isOpen]);

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
						chainID={currentVault?.current?.chainID || safeChainID}
						token={currentVault?.current?.token} />
				</motion.div>
			</header>

			<section className={'mt-4 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<VaultDetailsHeader currentVault={currentVault.current} />
				<ActionFlowContextApp currentVault={currentVault.current}>
					<WithSolverContextApp>
						<VaultActionsTabsWrapper currentVault={currentVault.current} />
					</WithSolverContextApp>
				</ActionFlowContextApp>
				<VaultDetailsTabsWrapper currentVault={currentVault.current} />
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

export default Index;

Index.getInitialProps = async ({query}: NextPageContext): Promise<unknown> => {
	const	address = toAddress((query?.address as string)?.split('/').pop() || '');
	const	chainID = query?.chainID;
	const	res = await fetch(`${process.env.YDAEMON_BASE_URI}/${chainID}/vaults/${address}?hideAlways=true&orderBy=apy.net_apy&orderDirection=desc&strategiesDetails=withDetails&strategiesRisk=withRisk&strategiesCondition=inQueue`);
	const	json = await res.json();

	return {vaultData: json};
};
