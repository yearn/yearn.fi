import {useMemo} from 'react';
import {useContractRead} from 'wagmi';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {VAULT_V3_ABI} from '@vaults/utils/abi/vaultV3.abi';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {copyToClipboard} from '@yearn-finance/web-lib/utils/helpers';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {RenderAmount} from '@common/components/RenderAmount';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {IconQuestion} from '@common/icons/IconQuestion';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
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
			<p className={'text-center text-xs text-neutral-900/70'}>{label}</p>
			<b
				className={'font-number text-base md:text-3xl'}
				suppressHydrationWarning>
				{children}
			</b>
			<legend
				className={'font-number whitespace-nowrap text-center text-xs text-neutral-900/70'}
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
						<IconQuestion className={'hidden md:block'} />
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

function ValueInToken(props: {currentVault: TYDaemonVault; vaultPrice: number; deposited: bigint}): ReactElement {
	const {data: convertedToAsset} = useContractRead({
		address: props.currentVault.address,
		abi: VAULT_V3_ABI,
		chainId: props.currentVault.chainID,
		functionName: 'convertToAssets',
		args: [props.deposited],
		select: (r): TNormalizedBN => toNormalizedBN(r, props.currentVault.token.decimals),
		watch: true,
		keepPreviousData: true
	});

	return (
		<VaultHeaderLineItem
			label={`Value in ${props.currentVault.token.symbol || 'tokens'}`}
			legend={
				<span className={'tooltip'}>
					<div className={'flex flex-row items-center space-x-2'}>
						<div>{formatCounterValue(convertedToAsset?.normalized || 0, props.vaultPrice)}</div>
						<IconQuestion className={'hidden md:block'} />
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
								{`Your yield is accruing every single block. Go you!`}
							</p>
						</div>
					</span>
				</span>
			}>
			<RenderAmount
				value={toBigInt(convertedToAsset?.raw)}
				decimals={props.currentVault.token.decimals}
			/>
		</VaultHeaderLineItem>
	);
}

export function VaultDetailsHeader({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {address, apr, tvl, decimals, symbol = 'token', token} = currentVault;
	const chainInfo = getNetwork(currentVault.chainID);
	const vaultBalance = useBalance({address, chainID: currentVault.chainID});
	const vaultPrice = useTokenPrice(address) || currentVault?.tvl?.price || 0;
	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const {stakingRewardsByVault, positionsMap} = useStakingRewards();
	const stakedBalance = toBigInt(positionsMap[toAddress(stakingRewardsByVault[address])]?.stake);
	const depositedAndStaked = toNormalizedBN(vaultBalance.raw + stakedBalance, decimals);

	return (
		<div className={'col-span-12 mt-4 flex w-full flex-col items-center justify-center'}>
			<strong
				className={cl(
					'mx-auto flex w-full flex-row items-center justify-center text-center',
					'text-3xl md:text-[64px] leading-[36px] md:leading-[72px]',
					'tabular-nums text-neutral-900 font-black'
				)}>
				{vaultName}
			</strong>

			<div className={'mb-10 mt-6 flex flex-col justify-center md:mt-4'}>
				{address ? (
					<button onClick={(): void => copyToClipboard(address)}>
						<p className={'font-number text-center text-xxs text-neutral-900/70 md:text-xs'}>{address}</p>
					</button>
				) : (
					<p className={'text-xxs md:text-xs'}>&nbsp;</p>
				)}
				<div className={'mt-4 flex flex-col gap-2 md:flex-row'}>
					<div className={'w-full rounded-lg bg-neutral-900/30 px-4 py-2 text-center md:w-fit'}>
						<strong className={'text-sm font-black text-neutral-900 md:text-xl'}>
							{currentVault.token.name}
						</strong>
					</div>
					<div className={'w-full rounded-lg bg-neutral-900/30 px-4 py-2 text-center md:w-fit'}>
						<strong className={'text-sm font-black text-neutral-900 md:text-xl'}>{chainInfo.name}</strong>
					</div>
				</div>
			</div>

			<div className={'grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-14'}>
				<VaultHeaderLineItem
					label={`Total deposited, ${token?.symbol || 'tokens'}`}
					legend={formatUSD(tvl.tvl)}>
					<RenderAmount
						value={toBigInt(tvl.totalAssets)}
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

				<ValueInToken
					currentVault={currentVault}
					deposited={depositedAndStaked.raw}
					vaultPrice={vaultPrice}
				/>
			</div>
		</div>
	);
}
