import {useCallback} from 'react';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {Dropdown} from '@common/components/TokenDropdown';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';

import type {ChangeEvent, ReactElement} from 'react';

export function VaultDetailsQuickActionsFrom(): ReactElement {
	const {isActive} = useWeb3();
	const {getToken} = useWallet();
	const {
		possibleOptionsFrom,
		actionParams,
		onUpdateSelectedOptionFrom,
		onChangeAmount,
		maxDepositPossible,
		isDepositing
	} = useActionFlow();
	const selectedFromBalance = useBalance({
		address: toAddress(actionParams?.selectedOptionFrom?.value),
		chainID: Number(actionParams?.selectedOptionFrom?.chainID)
	});
	const selectedOptionFromPricePerToken = useTokenPrice(toAddress(actionParams?.selectedOptionFrom?.value));
	const hasMultipleInputsToChooseFrom = isActive && isDepositing && possibleOptionsFrom.length > 1;
	const selectedFromSymbol = actionParams?.selectedOptionFrom?.symbol || 'tokens';
	const selectedFromIcon = actionParams?.selectedOptionFrom?.icon;

	function renderMultipleOptionsFallback(): ReactElement {
		return (
			<Dropdown
				className={'!w-auto rounded-lg bg-neutral-300'}
				comboboxOptionsClassName={'bg-neutral-300 rounded-lg'}
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
				handleInputChangeEventValue(
					e.target.value,
					getToken({
						address: toAddress(actionParams?.selectedOptionFrom?.value),
						chainID: Number(actionParams?.selectedOptionFrom?.chainID)
					}).decimals
				)
			);
		},
		[actionParams?.selectedOptionFrom?.chainID, actionParams?.selectedOptionFrom?.value, getToken, onChangeAmount]
	);

	return (
		<section
			id={isActive ? 'active' : 'not-active'}
			className={'flex w-full flex-col space-x-0 md:flex-row md:space-x-4'}>
			<div className={'relative z-10 w-full'}>
				<div className={'flex flex-col items-baseline justify-between pb-2 pl-1 md:flex-row'}>
					<p className={'text-base text-neutral-600'}>{isDepositing ? 'From wallet' : 'From vault'}</p>
					<legend
						className={'font-number inline text-xs text-neutral-900/50 md:hidden'}
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
							'flex h-10 w-full items-center justify-between rounded-lg bg-neutral-300 px-2 text-base text-neutral-900 md:w-56 md:px-3'
						}>
						<div className={'relative flex flex-row items-center truncate'}>
							<div className={'h-6 w-6 flex-none rounded-full'}>{selectedFromIcon}</div>
							<p
								className={
									'truncate whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'
								}>
								{selectedFromSymbol}
							</p>
						</div>
					</div>
				</Renderable>

				<div className={'mt-1 pl-1'}>
					<legend
						className={'font-number hidden text-xs text-neutral-900/50 md:inline'}
						suppressHydrationWarning>
						{`You have ${formatAmount(selectedFromBalance.normalized)} ${
							actionParams?.selectedOptionFrom?.symbol || 'tokens'
						}`}
					</legend>
				</div>
			</div>
			<div className={'w-full'}>
				<div className={'pb-2 pl-1'}>
					<label
						htmlFor={'fromAmount'}
						className={'hidden text-base text-neutral-600 md:inline'}>
						{'Amount'}
					</label>
				</div>
				<div className={'flex h-10 items-center rounded-lg bg-neutral-300 p-2'}>
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
								'ml-2 cursor-pointer rounded-[4px] bg-neutral-800/20 px-2 py-1 text-xs text-neutral-900 transition-colors hover:bg-neutral-800/50'
							}>
							{'Max'}
						</button>
					</div>
				</div>
				<div className={'mt-1 pl-1'}>
					<legend
						suppressHydrationWarning
						className={'font-number hidden text-xs text-neutral-900/50 md:mr-0 md:inline md:text-start'}>
						{formatCounterValue(actionParams?.amount?.normalized || 0, selectedOptionFromPricePerToken)}
					</legend>
				</div>
			</div>
		</section>
	);
}
