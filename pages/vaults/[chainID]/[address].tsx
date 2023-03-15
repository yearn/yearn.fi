import React, {useEffect, useRef} from 'react';
import {motion} from 'framer-motion';
import {VaultActionsTabsWrapper} from '@vaults/components/details/VaultActionsTabsWrapper';
import {VaultDetailsHeader} from '@vaults/components/details/VaultDetailsHeader';
import {VaultDetailsTabsWrapper} from '@vaults/components/details/VaultDetailsTabsWrapper';
import ActionFlowContextApp from '@vaults/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults/contexts/useSolver';
import Wrapper from '@vaults/Wrapper';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {handleRawTVaut} from '@yearn-finance/web-lib/types/vaults';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import TokenIcon from '@common/components/TokenIcon';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {variants} from '@common/utils/animations';

import type {NextPageContext} from 'next';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TVault} from '@yearn-finance/web-lib/types/vaults';

function Index({router, vaultData}: {router: NextRouter, vaultData: TVault}): ReactElement | null {
	const {address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {vaults} = useYearn();
	const {refresh} = useWallet();
	const currentVault = useRef<TVault>(vaults[toAddress(router.query.address as string)] as TVault || handleRawTVaut(vaultData));

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

	if (!currentVault) {
		return null;
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
						chainID={currentVault?.current?.chainID || safeChainID}
						token={currentVault?.current?.token} />
				</motion.div>
			</header>

			<section className={'mt-4 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<VaultDetailsHeader currentVault={currentVault.current} />
				<ActionFlowContextApp currentVault={currentVault.current}>
					<WithSolverContextApp>
						<VaultActionsTabsWrapper />
					</WithSolverContextApp>
				</ActionFlowContextApp>
				<VaultDetailsTabsWrapper currentVault={currentVault.current} />
			</section>
		</>
	);
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
	const	strAddress = query?.address as string;
	const	address = toAddress(strAddress?.split('/').pop() || '');
	const	chainID = query?.chainID;
	const	res = await fetch(`${process.env.YDAEMON_BASE_URI}/${chainID}/vaults/${address}?hideAlways=true&orderBy=apy.net_apy&orderDirection=desc&strategiesDetails=withDetails&strategiesRisk=withRisk&strategiesCondition=inQueue`);
	const	json = await res.json();

	return {vaultData: json};
};
