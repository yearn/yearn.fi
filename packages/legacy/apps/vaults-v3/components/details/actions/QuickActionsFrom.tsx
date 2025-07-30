import {Renderable} from '@lib/components/Renderable';
import {Dropdown} from '@lib/components/TokenDropdown';
import {useWallet} from '@lib/contexts/useWallet';
import {useWeb3} from '@lib/contexts/useWeb3';
import {useYearn} from '@lib/contexts/useYearn';
import {IconQuestion} from '@lib/icons/IconQuestion';
import type {TNormalizedBN} from '@lib/types';
import {
	cl,
	formatAmount,
	formatCounterValue,
	formatPercent,
	handleInputChangeEventValue,
	isAddress,
	toAddress,
	zeroNormalizedBN
} from '@lib/utils';
import {calculateBoostFromVeYFI} from '@lib/utils/calculations';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import {useActionFlow} from '@vaults-v2/contexts/useActionFlow';
import type {TStakingInfo} from '@vaults-v2/hooks/useVaultStakingData';
import {useRouter} from 'next/router';
import type {ChangeEvent, ReactElement} from 'react';
import {useCallback, useMemo} from 'react';

function AmountWithOptionalTooltip(props: {
	canOnlyWithdrawSome: boolean;
	maxPossibleToWithdraw: TNormalizedBN;
	tokenSymbol: string;
}): ReactElement {
	if (props.canOnlyWithdrawSome) {
		if (props.maxPossibleToWithdraw.raw === 0n) {
			return (
				<div className={'flex flex-row items-center justify-between space-x-2'}>
					<label htmlFor={'fromAmount'} className={'hidden text-base text-neutral-600 md:inline'}>
						{'Amount'}
					</label>
					<span className={'tooltip'}>
						<IconQuestion className={'hidden opacity-40 md:block'} />
						<span className={'tooltipLight top-full w-full pt-1'}>
							<div
								className={
									'font-number mr-[-360px] max-w-sm border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
								}
							>
								<p
									className={
										'font-number whitespace-pre text-wrap text-left text-neutral-400 md:text-xs'
									}
								>
									{`This Vault is not always totally liquid.\n\nRight now, you cannot withdraw your ${props.tokenSymbol}.\n\nLike the best things in life, liquidity comes and goes so feel free to check back later.`}
								</p>
							</div>
						</span>
					</span>
				</div>
			);
		}
		return (
			<div className={'flex flex-row items-center justify-between space-x-2'}>
				<label htmlFor={'fromAmount'} className={'hidden text-base text-neutral-600 md:inline'}>
					{'Amount'}
				</label>
				<span className={'tooltip'}>
					<IconQuestion className={'hidden opacity-40 md:block'} />
					<span className={'tooltipLight top-full w-full pt-1'}>
						<div
							className={
								'font-number mr-[-360px] max-w-sm border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
							}
						>
							<p className={'font-number whitespace-pre text-wrap text-left text-neutral-400 md:text-xs'}>
								{`This Vault is not always totally liquid (don't worry anon, funds are Safu).\n\nYou can currently withdraw up to ${formatAmount(props.maxPossibleToWithdraw.normalized, 6)} ${props.tokenSymbol}.\n\nLike the best things in life, liquidity comes and goes so feel free to check back later.`}
							</p>
						</div>
					</span>
				</span>
			</div>
		);
	}
	return (
		<div>
			<label htmlFor={'fromAmount'} className={'hidden text-base text-neutral-600 md:inline'}>
				{'Amount'}
			</label>
		</div>
	);
}

export function VaultDetailsQuickActionsFrom(props: {
	currentVault: TYDaemonVault;
	vaultData: TStakingInfo;
	veYFIBalance: TNormalizedBN;
	veYFITotalSupply: number;
	gaugeTotalSupply: number;
}): ReactElement {
	const {address, isActive} = useWeb3();
	const {getToken, getBalance} = useWallet();
	const {getPrice} = useYearn();
	const {pathname} = useRouter();

	const isV3Page = pathname.startsWith('/v3');
	const {
		possibleOptionsFrom,
		actionParams,
		onUpdateSelectedOptionFrom,
		onChangeAmount,
		maxDepositPossible,
		maxWithdrawPossible,
		isDepositing
	} = useActionFlow();
	const hasMultipleInputsToChooseFrom = isActive && isDepositing && possibleOptionsFrom.length > 1;
	const selectedFromSymbol = actionParams?.selectedOptionFrom?.symbol || 'tokens';
	const selectedFromIcon = actionParams?.selectedOptionFrom?.icon;
	const selectedOptionFromPricePerToken = getPrice({
		address: toAddress(actionParams?.selectedOptionFrom?.value),
		chainID: Number(actionParams?.selectedOptionFrom?.chainID)
	});

	const currentVaultBoost = useMemo(
		() =>
			calculateBoostFromVeYFI(
				props.veYFIBalance.normalized,
				props.veYFITotalSupply,
				props.gaugeTotalSupply,
				props.vaultData.stakedBalanceOf.normalized
			),
		[props.veYFIBalance.normalized, props.veYFITotalSupply, props.gaugeTotalSupply, props.vaultData]
	);
	const currentStakedAPR =
		currentVaultBoost * (props.currentVault.apr.extra.stakingRewardsAPR / 10) +
		props.currentVault.apr.forwardAPR.netAPR;

	const userBalance = useMemo(() => {
		if (!isAddress(address)) {
			return zeroNormalizedBN;
		}
		return getBalance({
			address: toAddress(actionParams?.selectedOptionFrom?.value),
			chainID: Number(actionParams?.selectedOptionFrom?.chainID)
		});
	}, [address, getBalance, actionParams?.selectedOptionFrom?.value, actionParams?.selectedOptionFrom?.chainID]);

	/**********************************************************************************************
	 ** Fallback component to render a dropdown if the user has multiple options to choose from.
	 *********************************************************************************************/
	function renderMultipleOptionsFallback(): ReactElement {
		return (
			<Dropdown
				className={isV3Page ? 'w-full rounded-lg bg-neutral-300 md:!w-fit' : 'rounded-lg'}
				comboboxOptionsClassName={isV3Page ? 'bg-neutral-300 w-full rounded-lg' : 'rounded-lg'}
				defaultOption={possibleOptionsFrom[0]}
				options={possibleOptionsFrom}
				selected={actionParams?.selectedOptionFrom}
				onSelect={onUpdateSelectedOptionFrom}
			/>
		);
	}

	/**********************************************************************************************
	 ** Function to handle the input change event. This function will be called every time the user
	 ** types in the input field. It will check if the value is empty, if it is, it will set the
	 ** amount to undefined. If it is not, it will format the value and set it as the new amount.
	 *********************************************************************************************/
	const onChangeInput = useCallback(
		(e: ChangeEvent<HTMLInputElement>): void => {
			let newAmount: TNormalizedBN | undefined;
			const {decimals} = getToken({
				address: toAddress(actionParams?.selectedOptionFrom?.value),
				chainID: Number(actionParams?.selectedOptionFrom?.chainID)
			});

			if (e.target.value === '') {
				newAmount = undefined;
				onChangeAmount(newAmount);
			} else {
				const expectedNewValue = handleInputChangeEventValue(e, decimals);
				onChangeAmount(expectedNewValue);
			}
		},
		[actionParams?.selectedOptionFrom?.chainID, actionParams?.selectedOptionFrom?.value, getToken, onChangeAmount]
	);

	return (
		<section
			id={isActive ? 'active' : 'not-active'}
			className={'grid w-full flex-col gap-0 md:grid-cols-2 md:flex-row md:gap-4'}
		>
			<div className={'relative w-full'}>
				<div className={'flex flex-col items-baseline justify-between pb-2 pl-1 md:flex-row'}>
					<p className={'text-base text-neutral-600'}>{isDepositing ? 'From wallet' : 'From vault'}</p>
					<legend
						className={'font-number inline text-xs text-neutral-900/50 md:hidden'}
						suppressHydrationWarning
					>
						{`You have ${formatAmount((userBalance || zeroNormalizedBN).normalized)} ${
							actionParams?.selectedOptionFrom?.symbol || 'tokens'
						}`}
					</legend>
				</div>
				<Renderable shouldRender={!hasMultipleInputsToChooseFrom} fallback={renderMultipleOptionsFallback()}>
					<div
						className={
							'flex h-10 w-full items-center justify-between rounded-lg bg-neutral-300 px-2 text-base text-neutral-900 md:px-3'
						}
					>
						<div className={'relative flex flex-row items-center truncate'}>
							<div className={'size-6 flex-none rounded-full'}>{selectedFromIcon}</div>
							<p
								className={
									'truncate whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'
								}
							>
								{selectedFromSymbol}
							</p>
						</div>
					</div>
				</Renderable>

				<div className={'mt-1 pl-1'}>
					<legend className={'hidden text-xs text-neutral-900/50 md:inline'} suppressHydrationWarning>
						<div>
							<p className={'font-number'}>
								{`You have ${formatAmount((userBalance || zeroNormalizedBN).normalized)} ${
									actionParams?.selectedOptionFrom?.symbol || 'tokens'
								}`}
							</p>
							{props.vaultData?.stakedBalanceOf.raw > 0n && (
								<p className={'font-number'}>
									{`(+${formatAmount(props.vaultData.stakedBalanceOf.normalized, 6)} ${actionParams?.selectedOptionFrom?.symbol} staked earning ${formatPercent(currentStakedAPR * 100, 2, 2, 500)} APR)`}
								</p>
							)}
						</div>
					</legend>
				</div>
			</div>
			<div className={'w-full'}>
				<div className={'pb-2 pl-1'}>
					<AmountWithOptionalTooltip
						canOnlyWithdrawSome={!isDepositing && maxWithdrawPossible().isLimited}
						maxPossibleToWithdraw={maxWithdrawPossible().safeLimit}
						tokenSymbol={actionParams?.selectedOptionFrom?.symbol || 'tokens'}
					/>
				</div>
				<div
					className={cl(
						'flex h-10 items-center rounded-lg p-2 w-full',
						isV3Page ? 'bg-neutral-300' : 'bg-neutral-0'
					)}
				>
					<div className={'flex h-10 w-full flex-row items-center justify-between px-0 py-4'}>
						<input
							id={'fromAmount'}
							className={cl(
								'w-full overflow-x-scroll border-none bg-transparent px-0 py-4 font-bold outline-none scrollbar-none',
								isActive ? '' : 'cursor-not-allowed'
							)}
							type={'number'}
							inputMode={'numeric'}
							min={0}
							pattern={'^((?:0|[1-9]+)(?:.(?:d+?[1-9]|[1-9]))?)$'}
							autoComplete={'off'}
							disabled={!isActive}
							value={actionParams?.amount === undefined ? '' : actionParams?.amount.normalized}
							onChange={onChangeInput}
						/>
						<button
							onClick={(): void =>
								onChangeAmount(
									isDepositing
										? maxDepositPossible(toAddress(actionParams?.selectedOptionFrom?.value))
										: maxWithdrawPossible().safeLimit
								)
							}
							className={
								'ml-2 cursor-pointer rounded-[4px] bg-neutral-800/20 px-2 py-1 text-xs text-neutral-900 transition-colors hover:bg-neutral-800/50'
							}
						>
							{'Max'}
						</button>
					</div>
				</div>
				<div className={'mt-1 pl-1'}>
					<legend suppressHydrationWarning className={'hidden text-xs text-neutral-900/50 md:inline'}>
						<div>
							<p className={'font-number'}>
								{formatCounterValue(
									actionParams?.amount?.normalized || 0,
									Number(selectedOptionFromPricePerToken.normalized)
								)}
							</p>
						</div>
					</legend>
				</div>
			</div>
		</section>
	);
}
