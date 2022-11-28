import React, {ReactElement, useMemo} from 'react';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {format, toAddress} from '@yearn-finance/web-lib/utils';
import {useWallet} from 'contexts/useWallet';
import {useYearn} from 'contexts/useYearn';
import {baseFetcher, getCounterValue, getVaultName} from 'utils';

import type {TYearnVault} from 'types/yearn';

function	VaultDetailsHeader({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const	{address} = useWeb3();
	const	{balances} = useWallet();
	const	{prices} = useYearn();
	const	{data: earned} = useSWR(
		currentVault.address && address ? `${process.env.YDAEMON_BASE_URI}/1/earned/${address}/${currentVault.address}` : null,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	const	normalizedVaultBalance = useMemo((): number => (
		format.toNormalizedValue(
			balances[toAddress(currentVault?.address)]?.raw || 0,
			currentVault?.decimals
		)
	), [balances, currentVault]);

	const	normalizedVaultEarned = useMemo((): number => (
		format.toNormalizedValue(
			(earned?.[toAddress(currentVault?.address)]?.realizedGains || 0) + (earned?.[toAddress(currentVault?.address)]?.unrealizedGains || 0),
			currentVault?.decimals
		)
	), [earned, currentVault]);

	const	vaultPrice = useMemo((): number => (
		format.toNormalizedValue(
			format.BN(prices?.[toAddress(currentVault?.address)] || 0),
			6
		)
	), [currentVault?.address, prices]);

	const	vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);

	return (
		<div aria-label={'Vault Header'} className={'col-span-12 flex w-full flex-col items-center justify-center'}>
			<b className={'mx-auto flex w-full flex-row items-center justify-center text-center text-4xl tabular-nums text-neutral-900 md:text-8xl'}>
				&nbsp;{vaultName}&nbsp;
			</b>
			<div className={'mt-4 mb-10 md:mt-10 md:mb-14'}>
				{currentVault?.address ? <p className={'text-xs tabular-nums text-neutral-500'}>{currentVault.address}</p> : <p className={'text-xs text-neutral-500'}>&nbsp;</p>}
			</div>
			<div className={'grid grid-cols-2 gap-12 md:grid-cols-4'}>
				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{`Total staked, ${currentVault?.symbol || 'token'}`}
					</p>
					<b className={'text-3xl tabular-nums'} suppressHydrationWarning>
						{format.amount(format.toNormalizedValue(currentVault?.tvl?.total_assets, currentVault?.decimals), 2, 2)}
					</b>
					<legend className={'text-xs tabular-nums text-neutral-600'} suppressHydrationWarning>
						{`$ ${format.amount(currentVault?.tvl?.tvl, 2, 2)}`}
					</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{'Net APY'}
					</p>
					<b className={'text-3xl tabular-nums'} suppressHydrationWarning>
						{`${format.amount((currentVault?.apy?.net_apy || 0) * 100, 2, 2)} %`}
					</b>
					<legend className={'text-xs text-neutral-600'}>&nbsp;</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{`Balance, ${currentVault?.symbol || 'token'}`}
					</p>
					<b className={'text-3xl tabular-nums'} suppressHydrationWarning>
						{format.amount(normalizedVaultBalance, 2, 2)}
					</b>
					<legend className={'text-xs tabular-nums text-neutral-600'} suppressHydrationWarning>
						{getCounterValue(normalizedVaultBalance || 0, vaultPrice)}
					</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{`Earned, ${currentVault?.token?.symbol || 'token'}`}
					</p>
					<b className={'text-3xl tabular-nums'} suppressHydrationWarning>
						{format.amount(normalizedVaultEarned, 2, 2)}
					</b>
					<legend className={'text-xs tabular-nums text-neutral-600'} suppressHydrationWarning>
						{getCounterValue(normalizedVaultEarned || 0, vaultPrice)}
					</legend>
				</div>
			</div>
		</div>
	);
}


export {VaultDetailsHeader};