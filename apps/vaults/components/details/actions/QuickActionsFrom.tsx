import {useCallback} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {formatAmount, handleInputChangeValue, toAddress} from '@builtbymom/web3/utils';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useYearnWallet} from '@yearn-finance/web-lib/contexts/useYearnWallet';
import {useYearnBalance} from '@yearn-finance/web-lib/hooks/useYearnBalance';
import {useYearnTokenPrice} from '@yearn-finance/web-lib/hooks/useYearnTokenPrice';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {Dropdown} from '@common/components/TokenDropdown';

import type {ChangeEvent, ReactElement} from 'react';

export function VaultDetailsQuickActionsFrom(): ReactElement {
	const {isActive} = useWeb3();
	const {getToken} = useYearnWallet();
	const {
		possibleOptionsFrom,
		actionParams,
		onUpdateSelectedOptionFrom,
		onChangeAmount,
		maxDepositPossible,
		isDepositing
	} = useActionFlow();
	const selectedFromBalance = useYearnBalance({
		address: toAddress(actionParams?.selectedOptionFrom?.value),
		chainID: Number(actionParams?.selectedOptionFrom?.chainID)
	});
	const selectedOptionFromPricePerToken = useYearnTokenPrice({
		address: toAddress(actionParams?.selectedOptionFrom?.value),
		chainID: Number(actionParams?.selectedOptionFrom?.chainID)
	});
	const hasMultipleInputsToChooseFrom = isActive && isDepositing && possibleOptionsFrom.length > 1;
	const selectedFromSymbol = actionParams?.selectedOptionFrom?.symbol || 'tokens';
	const selectedFromIcon = actionParams?.selectedOptionFrom?.icon;

	function renderMultipleOptionsFallback(): ReactElement {
		return (
			<Dropdown
				defaultOption={possibleOptionsFrom[0]}
				options={possibleOptionsFrom}
				selected={actionParams?.selectedOptionFrom}
				onSelect={onUpdateSelectedOptionFrom}
			/>
		);
	}

	const onChangeInput = useCallback(
		(e: ChangeEvent<HTMLInputElement>): void => {
			onChangeAmount(
				handleInputChangeValue(
					e.target.value,
					getToken({
						address: toAddress(actionParams?.selectedOptionFrom?.value),
						chainID: Number(actionParams?.selectedOptionFrom?.chainID)
					}).decimals
				)
			);
		},
		[actionParams?.selectedOptionFrom, getToken, onChangeAmount]
	);

	return (
		<section
			id={isActive ? 'active' : 'not-active'}
			className={'flex w-full flex-col space-x-0 md:flex-row md:space-x-4'}>
			<div className={'relative z-10 w-full space-y-2'}>
				<div className={'flex flex-row items-baseline justify-between'}>
					<p className={'text-base text-neutral-600'}>{isDepositing ? 'From wallet' : 'From vault'}</p>
					<legend
						className={'font-number inline text-xs text-neutral-600 md:hidden'}
						suppressHydrationWarning>
						{`You have ${formatAmount(selectedFromBalance.normalized)} ${
							actionParams?.selectedOptionFrom?.symbol || 'tokens'
						}`}
					</legend>
				</div>
				<Renderable
					shouldRender={!hasMultipleInputsToChooseFrom}
					fallback={renderMultipleOptionsFallback()}>
					<div
						className={
							'flex h-10 w-full items-center justify-between bg-neutral-300 px-2 text-base text-neutral-900 md:px-3'
						}>
						<div className={'relative flex flex-row items-center truncate'}>
							<div className={'size-6 flex-none rounded-full'}>{selectedFromIcon}</div>
							<p
								className={
									'truncate whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'
								}>
								{selectedFromSymbol}
							</p>
						</div>
					</div>
				</Renderable>

				<legend
					className={'font-number hidden text-xs text-neutral-600 md:inline'}
					suppressHydrationWarning>
					{`You have ${formatAmount(selectedFromBalance.normalized)} ${
						actionParams?.selectedOptionFrom?.symbol || 'tokens'
					}`}
				</legend>
			</div>
			<div className={'w-full space-y-2'}>
				<label
					htmlFor={'fromAmount'}
					className={'hidden text-base text-neutral-600 md:inline'}>
					{'Amount'}
				</label>
				<div className={'flex h-10 items-center bg-neutral-0 p-2'}>
					<div className={'flex h-10 w-full flex-row items-center justify-between px-0 py-4'}>
						<input
							id={'fromAmount'}
							className={`w-full overflow-x-scroll border-none bg-transparent px-0 py-4 font-bold outline-none scrollbar-none ${
								isActive ? '' : 'cursor-not-allowed'
							}`}
							type={'text'}
							autoComplete={'off'}
							disabled={!isActive}
							value={actionParams?.amount.normalized}
							onChange={onChangeInput}
						/>
						<button
							onClick={(): void => onChangeAmount(maxDepositPossible)}
							className={
								'ml-2 cursor-pointer bg-neutral-900 px-2 py-1 text-xs text-neutral-0 transition-colors hover:bg-neutral-700'
							}>
							{'Max'}
						</button>
					</div>
				</div>
				<legend
					suppressHydrationWarning
					className={'font-number mr-1 text-end text-xs text-neutral-600 md:mr-0 md:text-start'}>
					{formatCounterValue(actionParams?.amount?.normalized || 0, selectedOptionFromPricePerToken)}
				</legend>
			</div>
		</section>
	);
}
