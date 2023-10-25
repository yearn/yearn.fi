import {useMemo} from 'react';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {copyToClipboard} from '@yearn-finance/web-lib/utils/helpers';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {RenderAmount} from '@common/components/RenderAmount';
import {useBalance} from '@common/hooks/useBalance';
import {useFetch} from '@common/hooks/useFetch';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {IconQuestion} from '@common/icons/IconQuestion';
import {yDaemonSingleEarnedSchema} from '@common/schemas/yDaemonEarnedSchema';
import {getVaultName} from '@common/utils';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {ReactElement} from 'react';
import type {TYDaemonEarnedSingle} from '@common/schemas/yDaemonEarnedSchema';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@common/types/types';

type TVaultHeaderLineItemProps = {
	label: string;
	children: ReactElement | string;
	legend?: ReactElement | string;
};

function VaultHeaderLineItem({label, children, legend}: TVaultHeaderLineItemProps): ReactElement {
	return (
		<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
			<p className={'text-center text-xxs md:text-xs'}>{label}</p>
			<b
				className={'font-number text-lg md:text-3xl'}
				suppressHydrationWarning>
				{children}
			</b>
			<legend
				className={'font-number text-xxs md:text-xs'}
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
	return (
		<VaultHeaderLineItem
			label={'Historical APR'}
			legend={
				<span className={'tooltip'}>
					<div className={'flex flex-row items-center space-x-2'}>
						<div>
							{'Est. APR - '}
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
				value={apr?.netAPR + apr.extra.stakingRewardsAPR}
				symbol={'percent'}
				decimals={6}
			/>
		</VaultHeaderLineItem>
	);
}

export function VaultDetailsHeader({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {address: userAddress} = useWeb3();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: currentVault.chainID});
	const {address, apr, tvl, decimals, symbol = 'token', token} = currentVault;
	const chainInfo = getNetwork(currentVault.chainID);
	const {data: earned} = useFetch<TYDaemonEarnedSingle>({
		endpoint: address && userAddress ? `${yDaemonBaseUri}/earned/${userAddress}/${currentVault.address}` : null,
		schema: yDaemonSingleEarnedSchema
	});

	const normalizedVaultEarned = useMemo((): TNormalizedBN => {
		const {unrealizedGains} = earned?.earned?.[toAddress(currentVault.address)] || {};
		const value = toBigInt(unrealizedGains);
		return toNormalizedBN(value < 0n ? 0n : value);
	}, [earned?.earned, currentVault.address]);

	const vaultBalance = useBalance({address, chainID: currentVault.chainID});
	const vaultPrice = useTokenPrice(address) || currentVault?.tvl?.price || 0;
	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const {stakingRewardsByVault, positionsMap} = useStakingRewards();
	const stakedBalance = toBigInt(positionsMap[toAddress(stakingRewardsByVault[address])]?.stake);
	const depositedAndStaked = toNormalizedBN(vaultBalance.raw + stakedBalance, decimals);

	return (
		<div
			aria-label={'Vault Header'}
			className={'col-span-12 mt-4 flex w-full flex-col items-center justify-center'}>
			<strong
				className={cl(
					'mx-auto flex w-full flex-row items-center justify-center text-center',
					'text-4xl md:text-[96px] leading-[56px] md:leading-[104px]',
					'tabular-nums text-neutral-900 font-black'
				)}>
				{vaultName}
			</strong>
			<div className={'mb-10 flex flex-col justify-center'}>
				{address ? (
					<button onClick={(): void => copyToClipboard(address)}>
						<p className={'font-number text-center text-xxs text-neutral-900 md:text-xs'}>{address}</p>
					</button>
				) : (
					<p className={'text-xxs md:text-xs'}>&nbsp;</p>
				)}
				<div className={'mt-4 flex flex-row space-x-2'}>
					<div className={'w-fit` rounded-lg bg-neutral-900/30 px-4 py-2'}>
						<strong className={'text-xl font-black text-neutral-900'}>{currentVault.token.name}</strong>
					</div>
					<div className={'w-fit` rounded-lg bg-neutral-900/30 px-4 py-2'}>
						<strong className={'text-xl font-black text-neutral-900'}>{chainInfo.name}</strong>
					</div>
				</div>
			</div>

			<div className={'grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-14'}>
				<VaultHeaderLineItem
					label={`Total deposited, ${token?.symbol || 'tokens'}`}
					legend={formatUSD(tvl.tvl)}>
					<RenderAmount
						value={tvl?.total_assets}
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
