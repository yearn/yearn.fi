import React, {ReactElement, useRef} from 'react';
import {NextRouter} from 'next/router';
import {motion} from 'framer-motion';
import {toAddress} from '@yearn-finance/web-lib/utils';
import {VaultDetailsHeader} from 'components/apps/vaults/VaultDetailsHeader';
import {VaultDetailsQuickActions} from 'components/apps/vaults/VaultDetailsQuickActions';
import {VaultDetailsTabsWrapper} from 'components/apps/vaults/VaultDetailsTabsWrapper';
import Wrapper from 'components/apps/vaults/Wrapper';
import {ImageWithFallback} from 'components/common/ImageWithFallback';
import {useYearn} from 'contexts/useYearn';

import type {NextPageContext} from 'next';
import type {TYearnVault} from 'types/yearn';

const transition = {duration: 0.3, ease: 'easeInOut'};
const variants = {
	initial: {y: -80, opacity: 0, transition},
	enter: {y: 0, opacity: 1, transition},
	exit: {y: -80, opacity: 0, transition}
};

function	Index({router, vaultData}: {router: NextRouter, vaultData: TYearnVault}): ReactElement {
	const	{vaults} = useYearn();
	const	currentVault = useRef<TYearnVault>(vaults[toAddress(router.query.address as string)] as TYearnVault || vaultData);

	return (
		<>
			<header className={'relative z-50 flex w-full items-center justify-center'}>
				<motion.div
					key={'vaults'}
					initial={'initial'}
					animate={'enter'}
					variants={variants}
					className={'absolute z-50 -mt-36 cursor-pointer'}>
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(currentVault.current.token.address)}/logo-128.png`}
						alt={''}
						width={72}
						height={72} />
				</motion.div>
			</header>

			<section className={'mt-4 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<VaultDetailsHeader currentVault={currentVault.current} />
				<VaultDetailsQuickActions currentVault={currentVault.current} />
				<VaultDetailsTabsWrapper currentVault={currentVault.current} />
			</section>
		</>
	);
}

Index.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default Index;

Index.getInitialProps = async ({query}: NextPageContext): Promise<unknown> => {
	const	address = toAddress((query?.address as string)?.split('/').pop() || '');
	const	res = await fetch(`${process.env.YDAEMON_BASE_URI}/1/vaults/${address}?hideAlways=true&orderBy=apy.net_apy&orderDirection=desc&strategiesDetails=withDetails&strategiesRisk=withRisk`);
	const	json = await res.json();

	return {vaultData: json};
};
