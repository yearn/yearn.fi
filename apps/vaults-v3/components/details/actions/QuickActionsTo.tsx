import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolver} from '@vaults/contexts/useSolver';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {Dropdown} from '@common/components/TokenDropdown';
import {useTokenPrice} from '@common/hooks/useTokenPrice';

import type {ReactElement} from 'react';

export function VaultDetailsQuickActionsTo(): ReactElement {
	const {isActive} = useWeb3();
	const {currentVault, possibleOptionsTo, actionParams, onUpdateSelectedOptionTo, isDepositing} = useActionFlow();
	const {expectedOut, isLoadingExpectedOut} = useSolver();
	const selectedOptionToPricePerToken = useTokenPrice(toAddress(actionParams?.selectedOptionTo?.value));
	const isMigrationAvailable = currentVault?.migration?.available;

	function renderMultipleOptionsFallback(): ReactElement {
		return (
			<Dropdown
				className={'!w-auto rounded-lg bg-neutral-300'}
				comboboxOptionsClassName={'bg-neutral-300 rounded-lg'}
				defaultOption={possibleOptionsTo[0]}
				options={possibleOptionsTo}
				selected={actionParams?.selectedOptionTo}
				onSelect={onUpdateSelectedOptionTo}
			/>
		);
	}

	return (
		<section className={'flex w-full flex-col space-x-0 md:flex-row md:space-x-4'}>
			<div className={'relative z-10 w-full'}>
				<div className={'flex flex-col items-baseline justify-between pb-2 pl-1 md:flex-row'}>
					<label className={'text-base text-neutral-600'}>
						{isDepositing || isMigrationAvailable ? 'To vault' : 'To wallet'}
					</label>
					<legend
						className={'font-number inline text-xs text-neutral-900/50 md:hidden'}
						suppressHydrationWarning>
						{`APR ${formatPercent(
							(currentVault.apr.netAPR + currentVault.apr.extra.stakingRewardsAPR) * 100,
							2,
							2,
							500
						)}`}
					</legend>
				</div>
				<Renderable
					shouldRender={!isActive || isDepositing || possibleOptionsTo.length === 1}
					fallback={renderMultipleOptionsFallback()}>
					<div
						className={
							'flex h-10 w-full items-center justify-between rounded-lg bg-neutral-300 px-2 text-base text-neutral-900 md:w-56 md:px-3'
						}>
						<div className={'relative flex flex-row items-center truncate'}>
							<div className={'h-6 w-6 flex-none rounded-full'}>
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
						{isDepositing
							? formatPercent(
									(currentVault.apr.netAPR + currentVault.apr.extra.stakingRewardsAPR) * 100,
									2,
									2,
									500
							  )
							: ''}
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
