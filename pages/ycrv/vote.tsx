import React, {useEffect, useRef} from 'react';
import Balancer from 'react-wrap-balancer';
import {VaultDetailsQuickActions} from '@vaults/components/details/VaultDetailsQuickActions';
import Wrapper from '@vaults/Wrapper';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {HeroTimer} from '@common/components/HeroTimer';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import GaugeList from '@yCRV/components/list/GaugeList';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TYearnGauge, TYearnVault} from '@common/types/yearn';

export const MOCK_GAUGE: TYearnGauge = {
	name: 'Gauge',
	address: '0x',
	category: 'Foo',
	token: {
		address: '0x000000000000000000000000000000000000dEaD'
	},
	votes: 0
};

function Index({router, vaultData}: {router: NextRouter, vaultData: TYearnVault}): ReactElement {
	const {address, isActive} = useWeb3();
	const {vaults} = useYearn();
	const currentVault = useRef<TYearnVault>(vaults[toAddress(router.query.address as string)] as TYearnVault || vaultData);
	const {refresh} = useWallet();

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

	
	return (
		<>
			<HeroTimer timeLeft={127579000} />
			<div className={'mt-8 mb-10 w-full max-w-6xl text-center'}>
				<Balancer>
					<b className={'text-center text-lg md:text-2xl'}>{'Vote For Your Gauge.'}</b>
					<p className={'mt-8 whitespace-pre-line text-center text-base text-neutral-600'}>
						{'... stats ...'}
					</p>
				</Balancer>
			</div>
			<section className={'mt-10 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<VaultDetailsQuickActions currentVault={currentVault.current} />
				<GaugeList />
			</section>
		</>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;

Index.getInitialProps = async (): Promise<unknown> => {
	const	address = toAddress(('0x27B5739e22ad9033bcBf192059122d163b60349D')?.split('/').pop() || '');
	const	chainID = 1;
	const	res = await fetch(`${process.env.YDAEMON_BASE_URI}/${chainID}/vaults/${address}?hideAlways=true&orderBy=apy.net_apy&orderDirection=desc&strategiesDetails=withDetails&strategiesRisk=withRisk&strategiesCondition=inQueue`);
	const	json = await res.json();

	return {vaultData: json};
};
