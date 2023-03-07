import React from 'react';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent, formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {copyToClipboard} from '@yearn-finance/web-lib/utils/helpers';
import {useBalance} from '@common/hooks/useBalance';
import {useClientOnlyFn} from '@common/hooks/useClientOnlyFn';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TCurrentVault} from '@yearn-finance/web-lib/types/vaults';
import type {TYdaemonEarned} from '@common/types/yearn';

function	VaultDetailsHeaderWrapped({currentVault, unrealizedGains}: TCurrentVault & {unrealizedGains: bigint}): ReactElement {
	const clientOnlyFormatAmount = useClientOnlyFn({fn: formatAmount, placeholder: '0,00'});
	const clientOnlyFormatPercent = useClientOnlyFn({fn: formatPercent, placeholder: '0,00'});
	const clientOnlyFormatUSD = useClientOnlyFn({fn: formatUSD, placeholder: '0,00'});
	const clientOnlyFormatCounterValue = useClientOnlyFn({fn: formatCounterValue, placeholder: '0,00'});

	const vaultBalance = useBalance(currentVault.address)?.normalized;
	const vaultPrice = useTokenPrice(currentVault.address);
	const vaultName = getVaultName(currentVault);
	const normalizedVaultEarned = formatToNormalizedValue(unrealizedGains, currentVault?.decimals);

	return (
		<div className={'col-span-12 flex w-full flex-col items-center justify-center'}>
			<b className={'mx-auto flex w-full flex-row items-center justify-center text-center text-4xl tabular-nums text-neutral-900 md:text-8xl'}>
				&nbsp;{vaultName}&nbsp;
			</b>
			<div className={'mt-4 mb-10 md:mt-10 md:mb-14'}>
				<button onClick={(): void => copyToClipboard(currentVault.address)}>
					<p className={'font-number text-xxs text-neutral-500 md:text-xs'}>{currentVault.address}</p>
				</button>
			</div>
			<div className={'grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-12'}>
				<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
					<p className={'text-center text-xxs text-neutral-600 md:text-xs'}>
						{`Total deposited, ${currentVault.symbol || 'token'}`}
					</p>
					<b className={'font-number text-lg md:text-3xl'}>
						{clientOnlyFormatAmount(formatToNormalizedValue(toBigInt(currentVault?.tvl?.total_assets), currentVault?.decimals))}
					</b>
					<legend className={'font-number text-xxs text-neutral-600 md:text-xs'}>
						{clientOnlyFormatUSD(currentVault?.tvl?.tvl)}
					</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
					<p className={'text-center text-xxs text-neutral-600 md:text-xs'}>
						{'Net APY'}
					</p>
					<b className={'font-number text-lg md:text-3xl'}>
						{clientOnlyFormatPercent((currentVault?.apy?.net_apy || 0) * 100, 2, 2, 500)}
					</b>
					<legend className={'text-xxs text-neutral-600 md:text-xs'}>&nbsp;</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
					<p className={'text-center text-xxs text-neutral-600 md:text-xs'}>
						{`Balance, ${currentVault.symbol || 'token'}`}
					</p>
					<b className={'font-number text-lg md:text-3xl'}>
						{clientOnlyFormatAmount(vaultBalance)}
					</b>
					<legend className={'font-number text-xxs text-neutral-600 md:text-xs'}>
						{clientOnlyFormatCounterValue(vaultBalance, vaultPrice)}
					</legend>
				</div>

				<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
					<p className={'text-center text-xxs text-neutral-600 md:text-xs'}>
						{`Earned, ${currentVault?.token?.symbol || 'token'}`}
					</p>
					<b className={'font-number text-lg md:text-3xl'}>
						{clientOnlyFormatAmount(normalizedVaultEarned)}
					</b>
					<legend className={'font-number text-xxs text-neutral-600 md:text-xs'}>
						{clientOnlyFormatCounterValue(normalizedVaultEarned || 0, vaultPrice)}
					</legend>
				</div>
			</div>
		</div>
	);
}

function	VaultDetailsHeader({currentVault}: TCurrentVault): ReactElement {
	const {safeChainID} = useChainID();
	const {address} = useWeb3();
	const {settings: baseAPISettings} = useSettings();

	const hasAddresses = currentVault.address && address;
	const baseURI = baseAPISettings.yDaemonBaseURI || process.env.YDAEMON_BASE_URI;
	const {data} = useSWR(
		hasAddresses ? `${baseURI}/${safeChainID}/earned/${address}/${currentVault.address}` : null,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse as {data: TYdaemonEarned};

	return (
		<VaultDetailsHeaderWrapped
			currentVault={currentVault}
			unrealizedGains={toBigInt(data?.earned?.[toAddress(currentVault?.address)]?.unrealizedGains)} />
	);
}

export {VaultDetailsHeader};
