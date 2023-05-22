import React, {useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import * as Sentry from '@sentry/nextjs';
import {VaultDetailsTabsWrapper} from '@vaults/components/details/tabs/VaultDetailsTabsWrapper';
import {VaultActionsTabsWrapper} from '@vaults/components/details/VaultActionsTabsWrapper';
import {VaultDetailsHeader} from '@vaults/components/details/VaultDetailsHeader';
import ActionFlowContextApp from '@vaults/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults/contexts/useSolver';
import Wrapper from '@vaults/Wrapper';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {isTAddress} from '@yearn-finance/web-lib/utils/isTAddress';
import CHAINS from '@yearn-finance/web-lib/utils/web3/chains';
import TokenIcon from '@common/components/TokenIcon';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {ADDRESS_REGEX} from '@common/schemas/custom/addressSchema';
import {variants} from '@common/utils/animations';

import type {GetServerSideProps, GetServerSidePropsContext, InferGetServerSidePropsType} from 'next';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

function Index(vault: InferGetServerSidePropsType<typeof getServerSideProps>): ReactElement {
	const {address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {vaults} = useYearn();
	const router = useRouter();
	const {refresh} = useWallet();
	const {toast, toastMaster} = yToast();
	
	const [toastState, set_toastState] = useState<{id?: string; isOpen: boolean}>({isOpen: false});
	const currentVault = useRef<TYDaemonVault>(vaults[toAddress(router.query.address as string)] || vault);

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
				<VaultDetailsHeader vault={currentVault.current} />
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getServerSideProps: GetServerSideProps<TYDaemonVault> = async (context: GetServerSidePropsContext) => {
	const {chainID} = context.query;

	if (typeof chainID !== 'string' || !Object.keys(CHAINS).includes(chainID)) {
		return {notFound: true};
	}
	
	const address = getAddress(context.query.address);

	if (!address || !ADDRESS_REGEX.test(address) || isZeroAddress(address)) {
		return {notFound: true};
	}

	const queryParams = new URLSearchParams({
		hideAlways: 'true',
		orderBy: 'apy.net_apy',
		orderDirection: 'desc',
		strategiesDetails: 'withDetails',
		strategiesRisk: 'withRisk',
		strategiesCondition: 'inQueue'
	});

	const endpoint = `${process.env.YDAEMON_BASE_URI}/${chainID}/vaults/${address}?${queryParams}`;

	try {
		const res = await fetch(endpoint);
		const vault = await res.json();
		return {props: vault};
	} catch (error) {
		Sentry.captureException(error, {tags: {endpoint}});
		return {notFound: true};
	}
};

function getAddress(address?: string | string[]): TAddress | null {
	if (!address || typeof address !== 'string') {
		return null;
	}

	const rawAddress = address.split('/').pop();
	return isTAddress(rawAddress) ? rawAddress : null;
}

export default Index;
