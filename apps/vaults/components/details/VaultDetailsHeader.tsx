import {useMemo} from 'react';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedValue, toBigInt, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent, formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {copyToClipboard} from '@yearn-finance/web-lib/utils/helpers';
import {useBalance} from '@common/hooks/useBalance';
import {useFetch} from '@common/hooks/useFetch';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {yDaemonEarnedSchema} from '@common/schemas/yDaemonEarnedSchema';
import {getVaultName} from '@common/utils';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {ReactElement} from 'react';
import type {TYDaemonEarned} from '@common/schemas/yDaemonEarnedSchema';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

type TVaultHeaderLineItemProps = {
	label: string;
	children: string;
	legend?: string;
}

function VaultHeaderLineItem({label, children, legend}: TVaultHeaderLineItemProps): ReactElement {
	return (
		<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
			<p className={'text-center text-xxs text-neutral-600 md:text-xs'}>
				{label}
			</p>
			<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
				{children}
			</b>
			<legend className={'font-number text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
				{legend ? legend : '\u00A0'}
			</legend>
		</div>
	);
}

function VaultDetailsHeader({vault}: { vault: TYDaemonVault }): ReactElement {
	const {safeChainID} = useChainID();
	const {address: userAddress} = useWeb3();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: safeChainID});

	const {address, apy, tvl, decimals, symbol = 'token', token} = vault;

	const {data: earned} = useFetch<TYDaemonEarned>({
		endpoint: (address && userAddress) ? `${yDaemonBaseUri}/earned/${userAddress}` : null,
		schema: yDaemonEarnedSchema
	});

	const normalizedVaultEarned = useMemo((): number => {
		const {unrealizedGains} = earned?.earned?.[toAddress(address)] || {};
		const normalizedValue = formatToNormalizedValue(toBigInt(unrealizedGains), decimals);

		return normalizedValue > -0.01 ? Math.abs(normalizedValue) : normalizedValue;
	}, [earned?.earned, address, decimals]);

	const vaultBalance = useBalance(address)?.normalized;
	const vaultPrice = useTokenPrice(address);
	const vaultName = useMemo((): string => getVaultName(vault), [vault]);
	const {stakingRewardsByVault, positionsMap} = useStakingRewards();
	const stakedBalance = toNormalizedValue(toBigInt(positionsMap[toAddress(stakingRewardsByVault[address])]?.stake), decimals);
	const depositedAndStaked = vaultBalance + stakedBalance;

	return (
		<div aria-label={'Vault Header'} className={'col-span-12 flex w-full flex-col items-center justify-center'}>
			<b className={'mx-auto flex w-full flex-row items-center justify-center text-center text-4xl tabular-nums text-neutral-900 md:text-8xl'}>
				&nbsp;{vaultName}&nbsp;
			</b>
			<div className={'mb-10 mt-4 md:mb-14 md:mt-10'}>
				{address ? (
					<button onClick={(): void => copyToClipboard(address)}>
						<p className={'font-number text-xxs text-neutral-500 md:text-xs'}>{address}</p>
					</button>
				) : <p className={'text-xxs text-neutral-500 md:text-xs'}>&nbsp;</p>}
			</div>
			<div className={'grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-12'}>
				<VaultHeaderLineItem label={`Total deposited, ${symbol}`} legend={formatUSD(tvl.tvl)}>
					{formatAmount(formatToNormalizedValue(toBigInt(tvl.total_assets), decimals))}
				</VaultHeaderLineItem>

				<VaultHeaderLineItem label={'Net APY'}>
					{formatPercent(((apy.net_apy || 0) + (apy.staking_rewards_apr || 0)) * 100, 2, 2, 500)}
				</VaultHeaderLineItem>

				<VaultHeaderLineItem label={`Balance, ${symbol}`} legend={formatCounterValue(depositedAndStaked, vaultPrice)}>
					{formatAmount(depositedAndStaked)}
				</VaultHeaderLineItem>

				<VaultHeaderLineItem label={`Earned, ${token.symbol}`} legend={formatCounterValue(normalizedVaultEarned, vaultPrice)}>
					{formatAmount(normalizedVaultEarned)}
				</VaultHeaderLineItem>
			</div>
		</div>
	);
}

export {VaultDetailsHeader};
