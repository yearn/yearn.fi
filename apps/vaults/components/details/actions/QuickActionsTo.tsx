import React from 'react';
import {useQuickAction, useSolver} from '@vaults/components/VaultDetailsQuickActions';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {Dropdown} from '@common/components/TokenDropdown';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {formatPercent} from '@common/utils';

import type {ReactElement} from 'react';
import type {TDropdownOption} from '@common/types/types';

function	VaultDetailsQuickActionsTo(): ReactElement {
	const {
		currentVault,
		possibleOptionsTo, selectedOptionTo, onUpdateSelectedOptionTo,
		isDepositing
	} = useQuickAction();
	const {expectedOut, isLoadingExpectedOut} = useSolver();

	const selectedOptionToPricePerToken = useTokenPrice(toAddress(selectedOptionTo?.value));

	return (
		<section aria-label={'TO'} className={'flex w-full flex-col space-x-0 md:flex-row md:space-x-4'}>
			<div className={'relative z-10 w-full space-y-2'}>
				<div className={'flex flex-row items-baseline justify-between'}>
					<label className={'text-base text-neutral-600'}>
						{isDepositing ? 'To vault' : 'To wallet'}
					</label>
					<legend className={'font-number inline text-xs text-neutral-600 md:hidden'} suppressHydrationWarning>
						{`APY ${formatPercent((isDepositing ? currentVault?.apy?.net_apy || 0 : 0) * 100)}`}
					</legend>
				</div>
				{possibleOptionsTo.length > 1 ? (
					<Dropdown
						defaultOption={possibleOptionsTo[0]}
						options={possibleOptionsTo}
						selected={selectedOptionTo}
						onSelect={(option: TDropdownOption): void => onUpdateSelectedOptionTo(option)} />
				) : (
					<div className={'flex h-10 w-full items-center justify-between bg-neutral-100 px-2 text-base text-neutral-900 md:px-3'}>
						<div className={'relative flex flex-row items-center'}>
							<div className={'h-6 w-6 rounded-full'}>
								{selectedOptionTo?.icon}
							</div>
							<p className={'overflow-x-hidden text-ellipsis whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'}>
								{selectedOptionTo?.symbol}
							</p>
						</div>
					</div>
				)}
				<legend className={'font-number hidden text-xs text-neutral-600 md:inline'} suppressHydrationWarning>
					{isDepositing ? `APY ${formatPercent((currentVault?.apy?.net_apy || 0) * 100)}` : ''}
				</legend>
			</div>

			<div className={'w-full space-y-2'}>
				<label
					htmlFor={'toAmount'}
					className={'hidden text-base text-neutral-600 md:inline'}>
					{'You will receive'}
				</label>
				<div className={'flex h-10 items-center bg-neutral-300 p-2'}>
					<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
						{isLoadingExpectedOut ?
							<div className={'relative h-10 w-full'}>
								<div className={'absolute left-3 flex h-10 items-center justify-center'}>
									<span className={'loader'} />
								</div>
							</div> :
							<input
								id={'toAmount'}
								className={'w-full cursor-default overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none'}
								type={'text'}
								disabled
								value={expectedOut?.normalized || 0} />
						}
					</div>
				</div>
				<legend className={'font-number mr-1 text-end text-xs text-neutral-600 md:mr-0 md:text-start'}>
					{formatCounterValue(expectedOut?.normalized || 0, selectedOptionToPricePerToken)}
				</legend>
			</div>
		</section>
	);
}

export default VaultDetailsQuickActionsTo;