import React, {useCallback} from 'react';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import ChildWithCondition from '@yearn-finance/web-lib/components/ChildWithCondition';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNumber} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {Dropdown} from '@common/components/TokenDropdown';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';

import type {ChangeEvent, ReactElement} from 'react';

function	FromTokenSelector(): ReactElement {
	const {isActive} = useWeb3();
	const {possibleOptionsFrom, actionParams, onUpdateSelectedOptionFrom, isDepositing} = useActionFlow();
	const selectedFromBalance = useBalance(toAddress(actionParams?.selectedOptionFrom?.value));

	/* 🔵 - Yearn Finance **************************************************************************
	** Handle the input change event
	**********************************************************************************************/
	const hasMultipleInputsToChooseFrom = isActive && isDepositing && possibleOptionsFrom.length > 1;
	const selectedFromSymbol = actionParams?.selectedOptionFrom?.symbol || 'tokens';
	const selectedFromIcon = actionParams?.selectedOptionFrom?.symbol || 'tokens';


	/* 🔵 - Yearn Finance **************************************************************************
	** Fallback rendering for when there are multiple options to choose from
	**********************************************************************************************/
	function	renderMultipleInputDropdownFallback(): ReactElement {
		return (
			<Dropdown
				defaultOption={possibleOptionsFrom[0]}
				options={possibleOptionsFrom}
				selected={actionParams?.selectedOptionFrom}
				onSelect={onUpdateSelectedOptionFrom} />
		);
	}


	/* 🔵 - Yearn Finance **************************************************************************
	** Rendering this component
	**********************************************************************************************/
	return (
		<div className={'relative z-10 w-full space-y-2'}>
			<div className={'flex flex-row items-baseline justify-between'}>
				<label className={'text-base text-neutral-600'}>
					{isDepositing ? 'From wallet' : 'From vault'}
				</label>
				<legend className={'font-number inline text-xs text-neutral-600 md:hidden'} suppressHydrationWarning>
					{`You have ${formatAmount(selectedFromBalance.normalized)} ${selectedFromSymbol}`}
				</legend>
			</div>

			<ChildWithCondition
				shouldRender={!hasMultipleInputsToChooseFrom}
				fallback={renderMultipleInputDropdownFallback()}>
				<div className={'flex h-10 w-full items-center justify-between bg-neutral-300 px-2 text-base text-neutral-900 md:px-3'}>
					<div className={'relative flex flex-row items-center'}>
						<div className={'h-6 w-6 rounded-full'}>
							{selectedFromIcon}
						</div>
						<p className={'overflow-x-hidden text-ellipsis whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'}>
							{selectedFromSymbol}
						</p>
					</div>
				</div>
			</ChildWithCondition>

			<legend className={'font-number hidden text-xs text-neutral-600 md:inline'} suppressHydrationWarning>
				{`You have ${formatAmount(selectedFromBalance.normalized)} ${selectedFromSymbol}`}
			</legend>
		</div>
	);
}
function	FromTokenAmount(): ReactElement {
	const {isActive} = useWeb3();
	const {actionParams, onChangeAmount, maxDepositPossible} = useActionFlow();

	/* 🔵 - Yearn Finance **************************************************************************
	** Declare the variable we will need for this component in an easy to read way.
	**********************************************************************************************/
	const selectedFromAddress = toAddress(actionParams?.selectedOptionFrom?.value);
	const selectedFromDecimals = toNumber(actionParams?.selectedOptionFrom?.decimals, 18);
	const selectedOptionFromPricePerToken = useTokenPrice(selectedFromAddress);


	/* 🔵 - Yearn Finance **************************************************************************
	** Handle the input change event
	**********************************************************************************************/
	const onChangeInput = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
		onChangeAmount(handleInputChangeEventValue(e.target.value, selectedFromDecimals));
	}, [onChangeAmount, selectedFromDecimals]);


	/* 🔵 - Yearn Finance **************************************************************************
	** Rendering this component
	**********************************************************************************************/
	return (
		<div className={'w-full space-y-2'}>
			<label
				htmlFor={'fromAmount'}
				className={'hidden text-base text-neutral-600 md:inline'}>
				{'Amount'}
			</label>

			<div className={'flex h-10 items-center bg-neutral-0 p-2'}>
				<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
					<input
						id={'fromAmount'}
						className={`w-full overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none ${isActive ? '' : 'cursor-not-allowed'}`}
						type={'text'}
						disabled={!isActive}
						value={actionParams?.amount.normalized}
						onChange={onChangeInput} />
					<button
						onClick={(): void => onChangeAmount(maxDepositPossible)}
						className={'ml-2 cursor-pointer bg-neutral-900 px-2 py-1 text-xs text-neutral-0 transition-colors hover:bg-neutral-700'}>
						{'Max'}
					</button>
				</div>
			</div>

			<legend className={'font-number mr-1 text-end text-xs text-neutral-600 md:mr-0 md:text-start'}>
				{formatCounterValue(actionParams?.amount?.normalized, selectedOptionFromPricePerToken)}
			</legend>
		</div>
	);
}
function	VaultDetailsQuickActionsFrom(): ReactElement {
	return (
		<section aria-label={'FROM'} className={'flex w-full flex-col space-x-0 md:flex-row md:space-x-4'}>
			<FromTokenSelector />
			<FromTokenAmount />
		</section>
	);
}

export default VaultDetailsQuickActionsFrom;
