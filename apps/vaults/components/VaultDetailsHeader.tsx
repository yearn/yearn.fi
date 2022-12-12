import React, {useMemo} from 'react';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {formatPercent, formatUSD, getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TYdaemonEarned, TYearnVault} from '@common/types/yearn';

function	VaultDetailsHeader({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {safeChainID} = useChainID();
	const {address} = useWeb3();
	const {settings: baseAPISettings} = useSettings();
	const {data: earned} = useSWR(
		currentVault.address && address ? `${baseAPISettings.yDaemonBaseURI}/${safeChainID}/earned/${address}/${currentVault.address}` : null,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse as {data: TYdaemonEarned};

	const	normalizedVaultEarned = useMemo((): number => (
		formatToNormalizedValue(
			(earned?.earned?.[toAddress(currentVault?.address)]?.unrealizedGains || '0'),
			currentVault?.decimals
		)
	), [earned, currentVault]);

	const	vaultBalance = useBalance(currentVault?.address)?.normalized;
	const	vaultPrice = useTokenPrice(currentVault?.address);
	const	vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);

	return (
		<div aria-label={'Vault Header'} className={'col-span-12 flex w-full flex-col items-center justify-center'}>
			<b className={'mx-auto flex w-full flex-row items-center justify-center text-center text-4xl tabular-nums text-neutral-900 md:text-8xl'}>
				&nbsp;{vaultName}&nbsp;
			</b>
			<div className={'mt-4 mb-10 md:mt-10 md:mb-14'}>
				{currentVault?.address ? <p className={'font-number text-xs text-neutral-500'}>{currentVault.address}</p> : <p className={'text-xs text-neutral-500'}>&nbsp;</p>}
			</div>
			<div className={'grid grid-cols-2 gap-12 md:grid-cols-4'}>
				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{`Total deposited, ${currentVault?.symbol || 'token'}`}
					</p>
					<b className={'font-number text-3xl'} suppressHydrationWarning>
						{formatAmount(formatToNormalizedValue(currentVault?.tvl?.total_assets, currentVault?.decimals))}
					</b>
					<legend className={'font-number text-xs text-neutral-600'} suppressHydrationWarning>
						{formatUSD(currentVault?.tvl?.tvl)}
					</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{'Net APY'}
					</p>
					<b className={'font-number text-3xl'} suppressHydrationWarning>
						{formatPercent((currentVault?.apy?.net_apy || 0) * 100)}
					</b>
					<legend className={'text-xs text-neutral-600'}>&nbsp;</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{`Balance, ${currentVault?.symbol || 'token'}`}
					</p>
					<b className={'font-number text-3xl'} suppressHydrationWarning>
						{formatAmount(vaultBalance)}
					</b>
					<legend className={'font-number text-xs text-neutral-600'} suppressHydrationWarning>
						{formatCounterValue(vaultBalance, vaultPrice)}
					</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<p className={'text-center text-xs text-neutral-600'}>
						{`Earned, ${currentVault?.token?.symbol || 'token'}`}
					</p>
					<b className={'font-number text-3xl'} suppressHydrationWarning>
						{formatAmount(normalizedVaultEarned)}
					</b>
					<legend className={'font-number text-xs text-neutral-600'} suppressHydrationWarning>
						{formatCounterValue(normalizedVaultEarned || 0, vaultPrice)}
					</legend>
				</div>
			</div>
		</div>
	);
}


export {VaultDetailsHeader};