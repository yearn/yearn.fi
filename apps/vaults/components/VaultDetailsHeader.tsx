import React, {useMemo} from 'react';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TYdaemonEarned, TYearnVault} from '@common/types/yearn';


function	VaultDetailsHeader({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {safeChainID} = useChainID();
	const {address} = useWeb3();
	const {balances} = useWallet();
	const {prices} = useYearn();
	const {settings: baseAPISettings} = useSettings();
	const {data: earned} = useSWR(
		currentVault.address && address ? `${baseAPISettings.yDaemonBaseURI}/${safeChainID}/earned/${address}/${currentVault.address}` : null,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse as {data: TYdaemonEarned};

	const	normalizedVaultBalance = useMemo((): number => (
		formatToNormalizedValue(
			balances[toAddress(currentVault?.address)]?.raw || 0,
			currentVault?.decimals
		)
	), [balances, currentVault]);

	const	normalizedVaultEarned = useMemo((): number => (
		formatToNormalizedValue(
			(earned?.earned?.[toAddress(currentVault?.address)]?.unrealizedGains || '0'),
			currentVault?.decimals
		)
	), [earned, currentVault]);

	const	vaultPrice = useMemo((): number => (
		formatToNormalizedValue(
			formatBN(prices?.[toAddress(currentVault?.address)] || 0),
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
						{`Total deposited, ${currentVault?.symbol || 'token'}`}
					</p>
					<b className={'text-3xl tabular-nums'} suppressHydrationWarning>
						{formatAmount(formatToNormalizedValue(currentVault?.tvl?.total_assets, currentVault?.decimals), 2, 2)}
					</b>
					<legend className={'text-xs tabular-nums text-neutral-600'} suppressHydrationWarning>
						{`$ ${formatAmount(currentVault?.tvl?.tvl, 2, 2)}`}
					</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{'Net APY'}
					</p>
					<b className={'text-3xl tabular-nums'} suppressHydrationWarning>
						{`${formatAmount((currentVault?.apy?.net_apy || 0) * 100, 2, 2)} %`}
					</b>
					<legend className={'text-xs text-neutral-600'}>&nbsp;</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{`Balance, ${currentVault?.symbol || 'token'}`}
					</p>
					<b className={'text-3xl tabular-nums'} suppressHydrationWarning>
						{formatAmount(normalizedVaultBalance, 2, 2)}
					</b>
					<legend className={'text-xs tabular-nums text-neutral-600'} suppressHydrationWarning>
						{formatCounterValue(normalizedVaultBalance || 0, vaultPrice)}
					</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{`Earned, ${currentVault?.token?.symbol || 'token'}`}
					</p>
					<b className={'text-3xl tabular-nums'} suppressHydrationWarning>
						{formatAmount(normalizedVaultEarned, 2, 2)}
					</b>
					<legend className={'text-xs tabular-nums text-neutral-600'} suppressHydrationWarning>
						{formatCounterValue(normalizedVaultEarned || 0, vaultPrice)}
					</legend>
				</div>
			</div>
		</div>
	);
}


export {VaultDetailsHeader};