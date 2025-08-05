import { RenderAmount } from '@lib/components/RenderAmount'
import { Renderable } from '@lib/components/Renderable'
import { Dropdown } from '@lib/components/TokenDropdown'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { useYearnTokenPrice } from '@lib/hooks/useYearnTokenPrice'
import type { TNormalizedBN } from '@lib/types'
import { cl, formatCounterValue, formatPercent, toAddress } from '@lib/utils'
import { calculateBoostFromVeYFI } from '@lib/utils/calculations'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useActionFlow } from '@vaults-v2/contexts/useActionFlow'
import { useSolver } from '@vaults-v2/contexts/useSolver'
import type { TStakingInfo } from '@vaults-v2/hooks/useVaultStakingData'
import { useRouter } from 'next/router'
import { Fragment, type ReactElement, useMemo } from 'react'

function VaultAPY({
	currentVault,
	hasVeYFIBalance,
	currentVaultBoost,
	vaultData,
	stakedVaultBoost
}: {
	currentVault: TYDaemonVault
	hasVeYFIBalance: boolean
	currentVaultBoost: number
	vaultData: TStakingInfo
	stakedVaultBoost: number
}): ReactElement {
	const isSourceVeYFI = currentVault.staking.source === 'VeYFI'
	const { isAutoStakingEnabled } = useYearn()
	const { address } = useWeb3()

	const { actionParams } = useActionFlow()
	const inputAmount = actionParams?.amount?.normalized || 0
	const stakedBalance = vaultData.stakedBalanceOf.normalized

	const sumOfRewardsAPY = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.extra.gammaRewardAPR
	const veYFIRange = [
		currentVault.apr.extra.stakingRewardsAPR / 10 + currentVault.apr.extra.gammaRewardAPR,
		sumOfRewardsAPY
	] as [number, number]
	const estAPYRange = [
		veYFIRange[0] + currentVault.apr.forwardAPR.netAPR,
		veYFIRange[1] + currentVault.apr.forwardAPR.netAPR
	] as [number, number]

	/******************************************************************************************
	 ** There are 2 cases where we show the estimated APY range:
	 ** 1. Wallet is not connected and auto-staking is enabled.
	 ** 2. User has VeYFI balance, has no staked balance, auto-staking is enabled, and the amount input is 0/initial
	 ** state.
	 ******************************************************************************************/
	if (
		(!address && isAutoStakingEnabled) ||
		(isSourceVeYFI && isAutoStakingEnabled && hasVeYFIBalance && !inputAmount && stakedBalance === 0)
	) {
		return (
			<Fragment>
				<RenderAmount shouldHideTooltip value={estAPYRange[0]} symbol={'percent'} decimals={6} />
				&nbsp;&rarr;&nbsp;
				<RenderAmount shouldHideTooltip value={estAPYRange[1]} symbol={'percent'} decimals={6} />
			</Fragment>
		)
	}

	/******************************************************************************************
	 ** If the user has a VeYFI balance, staking source is VeYFI, auto-staking is enabled,
	 ** and the boost differs from the default value, we show the current calculated APY.
	 ******************************************************************************************/
	if (isSourceVeYFI && isAutoStakingEnabled && hasVeYFIBalance && currentVaultBoost > 1) {
		/******************************************************************************************
		 ** APY that is calculated based on input amount. AKA the APY that the user will get if
		 ** they deposit the full amount.
		 ******************************************************************************************/
		const currentVaultAPY = Math.min(
			currentVaultBoost * (currentVault.apr.extra.stakingRewardsAPR / 10) + currentVault.apr.forwardAPR.netAPR,
			veYFIRange[1] + currentVault.apr.forwardAPR.netAPR
		)

		/******************************************************************************************
		 ** APY that is calculated based on the already staked balance. AKA the APY that the user
		 ** is already earning.
		 ******************************************************************************************/
		const stakedVaultAPY = Math.min(
			stakedVaultBoost * (currentVault.apr.extra.stakingRewardsAPR / 10) + currentVault.apr.forwardAPR.netAPR
		)

		/******************************************************************************************
		 ** If the user has a staked balance, and the APYs are different, we show the difference
		 ** between the 2 APY's in case of depositing.
		 ******************************************************************************************/
		if (stakedBalance > 0 && stakedVaultAPY !== currentVaultAPY) {
			return (
				<Fragment>
					<span className={'line-through'}>
						<RenderAmount shouldHideTooltip value={stakedVaultAPY} symbol={'percent'} decimals={6} />
					</span>
					&nbsp;&rarr;&nbsp;
					<RenderAmount shouldHideTooltip value={currentVaultAPY} symbol={'percent'} decimals={6} />
				</Fragment>
			)
		}

		return <RenderAmount value={currentVaultAPY} symbol={'percent'} decimals={6} />
	}

	/******************************************************************************************
	 ** Display this if any of the following is true:
	 ** 1. Auto-staking is disabled.
	 ** 2. User does not have a VeYFI balance.
	 ** 3. Vault doesn't support staking.
	 ** 4. The boost is the default value.
	 ******************************************************************************************/
	return <Fragment>{formatPercent(currentVault.apr.forwardAPR.netAPR * 100, 2, 2, 500)}</Fragment>
}

export function VaultDetailsQuickActionsTo(props: {
	vaultData: TStakingInfo
	veYFIBalance: TNormalizedBN
	veYFITotalSupply: number
	gaugeTotalSupply: number
}): ReactElement {
	const { isActive } = useWeb3()
	const { currentVault, possibleOptionsTo, actionParams, onUpdateSelectedOptionTo, isDepositing, hasVeYFIBalance } =
		useActionFlow()
	const { isAutoStakingEnabled } = useYearn()

	const { expectedOut, isLoadingExpectedOut } = useSolver()
	const { pathname } = useRouter()
	const isV3Page = pathname.startsWith('/v3')
	const isMigrationAvailable = currentVault?.migration?.available
	const selectedOptionToPricePerToken = useYearnTokenPrice({
		address: toAddress(actionParams?.selectedOptionTo?.value),
		chainID: Number(actionParams?.selectedOptionTo?.chainID)
	})
	const selectedOptionToSymbol = useMemo(() => {
		if (isAutoStakingEnabled) {
			return props.vaultData.stakedGaugeSymbol || actionParams?.selectedOptionTo?.symbol
		}

		return actionParams?.selectedOptionTo?.symbol
	}, [actionParams?.selectedOptionTo?.symbol, isAutoStakingEnabled, props.vaultData.stakedGaugeSymbol])

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
	)

	const stakedVaultBoost = useMemo(
		() =>
			calculateBoostFromVeYFI(
				props.veYFIBalance.normalized,
				props.veYFITotalSupply,
				props.gaugeTotalSupply,
				props.vaultData.stakedBalanceOf.normalized
			),
		[props.veYFIBalance.normalized, props.veYFITotalSupply, props.gaugeTotalSupply, props.vaultData]
	)

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
		)
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
							stakedVaultBoost={stakedVaultBoost}
							vaultData={props.vaultData}
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
								{selectedOptionToSymbol}
							</p>
						</div>
					</div>
				</Renderable>
				<div className={'mt-1 pl-1'}>
					<legend className={'hidden text-xs text-neutral-900/50 md:inline'} suppressHydrationWarning>
						<div>
							<p className={'font-number'}>
								{isDepositing ? (
									<VaultAPY
										currentVault={currentVault}
										hasVeYFIBalance={hasVeYFIBalance}
										currentVaultBoost={currentVaultBoost}
										stakedVaultBoost={stakedVaultBoost}
										vaultData={props.vaultData}
									/>
								) : (
									''
								)}
							</p>
						</div>
					</legend>
				</div>
			</div>

			<div className={'w-full'}>
				<div className={'pb-2 pl-1'}>
					<label htmlFor={'toAmount'} className={'hidden text-base text-neutral-600 md:inline'}>
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
					<legend suppressHydrationWarning className={'hidden text-xs text-neutral-900/50 md:inline'}>
						<div>
							<p className={'font-number'}>
								{formatCounterValue(expectedOut?.normalized || 0, selectedOptionToPricePerToken)}
							</p>
						</div>
					</legend>
				</div>
			</div>
		</section>
	)
}
