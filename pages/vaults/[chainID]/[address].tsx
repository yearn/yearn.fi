import React, {useRef} from 'react';
import {motion} from 'framer-motion';
import {VaultDetailsHeader} from '@vaults/components/details/VaultDetailsHeader';
import {VaultDetailsQuickActions} from '@vaults/components/details/VaultDetailsQuickActions';
import {VaultDetailsTabsWrapper} from '@vaults/components/details/VaultDetailsTabsWrapper';
import Wrapper from '@vaults/Wrapper';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useYearn} from '@common/contexts/useYearn';
import {variants} from '@common/utils/animations';

import type {NextPageContext} from 'next';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TYearnVault} from '@common/types/yearn';

function Index({router, vaultData}: {router: NextRouter, vaultData: TYearnVault}): ReactElement {
	const {safeChainID} = useChainID();
	const {vaults} = useYearn();
	const currentVault = useRef<TYearnVault>(vaults[toAddress(router.query.address as string)] as TYearnVault || vaultData);

	return (
		<>
			<header className={'relative z-50 flex w-full items-center justify-center'}>
				<motion.div
					key={'vaults'}
					initial={'initial'}
					animate={'enter'}
					variants={variants}
					className={'absolute z-50 mt-0 h-12 w-12 cursor-pointer md:-mt-36 md:h-[72px] md:w-[72px]'}>
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_ASSETS_URI}/${safeChainID}/${toAddress(currentVault.current.token.address)}/logo-128.png`}
						alt={''}
						width={72}
						height={72} />
				</motion.div>
			</header>

			<section className={'mt-10 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<VaultDetailsHeader currentVault={currentVault.current} />
				<VaultDetailsQuickActions currentVault={currentVault.current} />
				<VaultDetailsTabsWrapper currentVault={currentVault.current} />
			</section>
		</>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;

Index.getInitialProps = async ({query}: NextPageContext): Promise<unknown> => {
	const	address = toAddress((query?.address as string)?.split('/').pop() || '');
	const	chainID = query?.chainID;
	const	res = await fetch(`${process.env.YDAEMON_BASE_URI}/${chainID}/vaults/${address}?hideAlways=true&orderBy=apy.net_apy&orderDirection=desc&strategiesDetails=withDetails&strategiesRisk=withRisk&strategiesCondition=inQueue`);
	const	json = await res.json();

	return {vaultData: json};
};
