import {Fragment, type ReactElement, useMemo} from 'react';
import {useRouter} from 'next/router';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {cl, formatCounterValue, formatPercent, toAddress} from '@builtbymom/web3/utils';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolver} from '@vaults/contexts/useSolver';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {RenderAmount} from '@common/components/RenderAmount';
import {Dropdown} from '@common/components/TokenDropdown';
import {useYearn} from '@common/contexts/useYearn';
import {useYearnTokenPrice} from '@common/hooks/useYearnTokenPrice';
import {calculateBoostFromVeYFI} from '@common/utils/calculations';

import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';
import type {TStakingInfo} from '@vaults/hooks/useVaultStakingData';

function VaultAPY({
	currentVault,
	hasVeYFIBalance,
	currentVaultBoost
}: {
	currentVault: TYDaemonVault;
	hasVeYFIBalance: boolean;
	currentVaultBoost: number;
}): ReactElement {
	const isSourceVeYFI = currentVault.staking.source === 'VeYFI';
	const {isAutoStakingEnabled} = useYearn();
	const {address} = useWeb3();

	const sumOfRewardsAPY = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.extra.gammaRewardAPR;
	const veYFIRange = [
		currentVault.apr.extra.stakingRewardsAPR / 10 + currentVault.apr.extra.gammaRewardAPR,
		sumOfRewardsAPY
	] as [number, number];
	const estAPYRange = [
		veYFIRange[0] + currentVault.apr.forwardAPR.netAPR,
		veYFIRange[1] + currentVault.apr.forwardAPR.netAPR
	] as [number, number];

	if (!address) {
		return (
			<Fragment>
				<RenderAmount
					shouldHideTooltip
					value={estAPYRange[0]}
					symbol={'percent'}
					decimals={6}
				/>
				&nbsp;&rarr;&nbsp;
				<RenderAmount
					shouldHideTooltip
					value={estAPYRange[1]}
					symbol={'percent'}
					decimals={6}
				/>
			</Fragment>
		);
	}

	if (isSourceVeYFI && isAutoStakingEnabled && hasVeYFIBalance && currentVaultBoost > 1) {
		const displayValue = Math.min(
			currentVaultBoost * (currentVault.apr.extra.stakingRewardsAPR / 10) + currentVault.apr.forwardAPR.netAPR,
			veYFIRange[1] + currentVault.apr.forwardAPR.netAPR
		);

		return (
			<Fragment>
				<RenderAmount
					value={displayValue}
					symbol={'percent'}
					decimals={6}
				/>
			</Fragment>
		);
	}

	return <Fragment>{formatPercent(estAPYRange[0] * 100, 2, 2, 500)}</Fragment>;
}

export function VaultDetailsQuickActionsTo(props: {
	vaultData: TStakingInfo;
	veYFIBalance: TNormalizedBN;
	veYFITotalSupply: number;
	gaugeTotalSupply: number;
}): ReactElement {
	const {isActive} = useWeb3();
	const {currentVault, possibleOptionsTo, actionParams, onUpdateSelectedOptionTo, isDepositing, hasVeYFIBalance} =
		useActionFlow();
	const {expectedOut, isLoadingExpectedOut} = useSolver();
	const {pathname} = useRouter();
	const isV3Page = pathname.startsWith(`/v3`);
	const isMigrationAvailable = currentVault?.migration?.available;
	const selectedOptionToPricePerToken = useYearnTokenPrice({
		address: toAddress(actionParams?.selectedOptionTo?.value),
		chainID: Number(actionParams?.selectedOptionTo?.chainID)
	});

	const currentVaultBoost = useMemo(
		() =>
			calculateBoostFromVeYFI(
				props.veYFIBalance.normalized,
				props.veYFITotalSupply,
				props.gaugeTotalSupply,
				(actionParams.amount?.normalized || 0) + props.vaultData.stakedBalanceOf.normalized
			),
		[
			props.veYFIBalance.normalized,
			props.veYFITotalSupply,
			props.gaugeTotalSupply,
			actionParams.amount?.normalized,
			props.vaultData
		]
	);

	function renderMultipleOptionsFallback(): ReactElement {
		return (
			<Dropdown
				className={isV3Page ? '!w-fit rounded-lg bg-neutral-300' : 'rounded-lg'}
				comboboxOptionsClassName={isV3Page ? 'bg-neutral-300 w-full rounded-lg' : 'rounded-lg'}
				defaultOption={possibleOptionsTo[0]}
				options={possibleOptionsTo}
				selected={actionParams?.selectedOptionTo}
				onSelect={onUpdateSelectedOptionTo}
			/>
		);
	}

	return (
		<section className={'grid w-full flex-col gap-0 md:grid-cols-2 md:flex-row md:gap-4'}>
			<div className={'relative w-full'}>
				<div className={'flex flex-col items-baseline justify-between pb-2 pl-1 md:flex-row'}>
					<p className={'text-base text-neutral-600'}>
						{isDepositing || isMigrationAvailable ? 'To vault' : 'To wallet'}
					</p>
					<legend
						className={'font-number inline text-xs text-neutral-900/50 md:hidden'}
						suppressHydrationWarning>
						<VaultAPY
							currentVault={currentVault}
							hasVeYFIBalance={hasVeYFIBalance}
							currentVaultBoost={currentVaultBoost}
						/>
					</legend>
				</div>
				<Renderable
					shouldRender={!isActive || isDepositing || possibleOptionsTo.length === 1}
					fallback={renderMultipleOptionsFallback()}>
					<div
						className={
							'flex h-10 w-full items-center justify-between rounded-lg bg-neutral-300 px-2 text-base text-neutral-900 md:px-3'
						}>
						<div className={'relative flex flex-row items-center truncate'}>
							<div className={'size-6 flex-none rounded-full'}>
								{actionParams?.selectedOptionTo?.icon}
							</div>
							<p
								className={
									'truncate whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'
								}>
								{actionParams?.selectedOptionTo?.symbol}
							</p>
						</div>
					</div>
				</Renderable>
				<div className={'mt-1 pl-1'}>
					<legend
						className={'font-number hidden text-xs text-neutral-900/50 md:inline'}
						suppressHydrationWarning>
						{isDepositing ? (
							<VaultAPY
								currentVault={currentVault}
								hasVeYFIBalance={hasVeYFIBalance}
								currentVaultBoost={currentVaultBoost}
							/>
						) : (
							''
						)}
					</legend>
				</div>
			</div>

			<div className={'w-full'}>
				<div className={'pb-2 pl-1'}>
					<label
						htmlFor={'toAmount'}
						className={'hidden text-base text-neutral-600 md:inline'}>
						{'You will receive'}
					</label>
				</div>
				<div className={'flex h-10 items-center rounded-lg bg-neutral-300 p-2'}>
					<div className={'flex h-10 w-full flex-row items-center justify-between px-0 py-4'}>
						{isLoadingExpectedOut ? (
							<div className={'relative h-10 w-full'}>
								<div className={'absolute left-3 flex h-10 items-center justify-center'}>
									<span className={'loader'} />
								</div>
							</div>
						) : (
							<input
								id={'toAmount'}
								className={cl(
									'w-full cursor-default bg-transparent rounded-lg',
									'px-0 py-4 font-bold',
									'overflow-x-scroll border-none outline-none scrollbar-none'
								)}
								type={'text'}
								disabled
								value={expectedOut?.normalized || 0}
								autoComplete={'off'}
							/>
						)}
					</div>
				</div>
				<div className={'mt-1 pl-1'}>
					<legend
						suppressHydrationWarning
						className={'font-number hidden text-xs text-neutral-900/50 md:mr-0 md:inline md:text-start'}>
						{formatCounterValue(expectedOut?.normalized || 0, selectedOptionToPricePerToken)}
					</legend>
				</div>
			</div>
		</section>
	);
}
