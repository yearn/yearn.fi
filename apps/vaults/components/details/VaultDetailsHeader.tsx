import {useMemo} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {formatUSD, isZero, toAddress, toBigInt, toNormalizedBN} from '@builtbymom/web3/utils';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {copyToClipboard} from '@yearn-finance/web-lib/utils/helpers';
import {RenderAmount} from '@common/components/RenderAmount';
import {useBalance} from '@common/hooks/useBalance';
import {useFetch} from '@common/hooks/useFetch';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {useYDaemonBaseURI} from '@common/hooks/useYDaemonBaseURI';
import {IconQuestion} from '@common/icons/IconQuestion';
import {yDaemonSingleEarnedSchema} from '@common/schemas/yDaemonEarnedSchema';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {TNormalizedBN} from '@builtbymom/web3/types';
import type {TYDaemonEarnedSingle} from '@common/schemas/yDaemonEarnedSchema';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

type TVaultHeaderLineItemProps = {
	label: string;
	children: ReactElement | string;
	legend?: ReactElement | string;
};

function VaultHeaderLineItem({label, children, legend}: TVaultHeaderLineItemProps): ReactElement {
	return (
		<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
			<p className={'text-center text-xxs text-neutral-600 md:text-xs'}>{label}</p>
			<b
				className={'font-number text-lg md:text-3xl'}
				suppressHydrationWarning>
				{children}
			</b>
			<legend
				className={'font-number text-xxs text-neutral-600 md:text-xs'}
				suppressHydrationWarning>
				{legend ? legend : '\u00A0'}
			</legend>
		</div>
	);
}

function VaultAPR({apr}: {apr: TYDaemonVault['apr']}): ReactElement {
	if (apr.forwardAPR.type === '' && apr.extra.stakingRewardsAPR === 0) {
		return (
			<VaultHeaderLineItem label={'Historical APR'}>
				<RenderAmount
					value={apr.netAPR + apr.extra.stakingRewardsAPR}
					symbol={'percent'}
					decimals={6}
				/>
			</VaultHeaderLineItem>
		);
	}

	const monthlyAPR = apr.netAPR + apr.extra.stakingRewardsAPR;
	const weeklyAPR = apr.points.weekAgo;
	return (
		<VaultHeaderLineItem
			label={'Historical APR'}
			legend={
				<span className={'tooltip'}>
					<div className={'flex flex-row items-center space-x-2'}>
						<div>
							{'Est. APR: '}
							<RenderAmount
								value={apr.forwardAPR.netAPR + apr.extra.stakingRewardsAPR}
								symbol={'percent'}
								decimals={6}
							/>
						</div>
						<IconQuestion />
					</div>
					<span className={'tooltipLight top-full mt-2'}>
						<div
							className={
								'font-number -mx-12 w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
							}>
							<p
								className={
									'font-number flex w-full flex-row justify-between text-neutral-400 md:text-xs'
								}>
								{'Estimated APR for the next period based on current data.'}
							</p>
						</div>
					</span>
				</span>
			}>
			<RenderAmount
				value={isZero(monthlyAPR) ? weeklyAPR : monthlyAPR}
				symbol={'percent'}
				decimals={6}
			/>
		</VaultHeaderLineItem>
	);
}

export function VaultDetailsHeader({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {address} = useWeb3();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: currentVault.chainID});
	const {apr, tvl, decimals, symbol = 'token', token} = currentVault;

	const {data: earned} = useFetch<TYDaemonEarnedSingle>({
		endpoint:
			currentVault.address && address ? `${yDaemonBaseUri}/earned/${address}/${currentVault.address}` : null,
		schema: yDaemonSingleEarnedSchema
	});

	const normalizedVaultEarned = useMemo((): TNormalizedBN => {
		const {unrealizedGains} = earned?.earned?.[toAddress(currentVault.address)] || {};
		const value = toBigInt(unrealizedGains);
		return toNormalizedBN(value < 0n ? 0n : value);
	}, [earned?.earned, currentVault.address]);

	const vaultBalance = useBalance({address: currentVault.address, chainID: currentVault.chainID});
	const stakedBalance = useBalance({address: currentVault.staking.address, chainID: currentVault.chainID});
	const vaultPrice =
		useTokenPrice({address: currentVault.address, chainID: currentVault.chainID}) || currentVault?.tvl?.price || 0;
	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const depositedAndStaked = currentVault.staking.available
		? toNormalizedBN(vaultBalance.raw + stakedBalance.raw, decimals)
		: vaultBalance;

	return (
		<div
			aria-label={'Vault Header'}
			className={'col-span-12 flex w-full flex-col items-center justify-center'}>
			<b
				className={
					'mx-auto flex w-full flex-row items-center justify-center text-center text-4xl tabular-nums text-neutral-900 md:text-8xl'
				}>
				&nbsp;{vaultName}&nbsp;
			</b>
			<div className={'mb-10 mt-4 md:mb-14 md:mt-10'}>
				{currentVault.address ? (
					<button onClick={(): void => copyToClipboard(currentVault.address)}>
						<p className={'font-number text-xxs text-neutral-500 md:text-xs'}>{currentVault.address}</p>
					</button>
				) : (
					<p className={'text-xxs text-neutral-500 md:text-xs'}>&nbsp;</p>
				)}
			</div>
			<div className={'grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-12'}>
				<VaultHeaderLineItem
					label={`Total deposited, ${token?.symbol || 'tokens'}`}
					legend={formatUSD(tvl.tvl)}>
					<RenderAmount
						value={tvl?.totalAssets}
						decimals={decimals}
					/>
				</VaultHeaderLineItem>

				<VaultAPR apr={apr} />

				<VaultHeaderLineItem
					label={`Balance, ${symbol}`}
					legend={formatCounterValue(depositedAndStaked.normalized, vaultPrice)}>
					<RenderAmount
						value={depositedAndStaked.raw}
						decimals={decimals}
					/>
				</VaultHeaderLineItem>

				<VaultHeaderLineItem
					label={`Earned, ${token?.symbol || 'tokens'}`}
					legend={formatCounterValue(normalizedVaultEarned.normalized, vaultPrice)}>
					<RenderAmount
						value={normalizedVaultEarned.raw}
						decimals={decimals}
					/>
				</VaultHeaderLineItem>
			</div>
		</div>
	);
}
