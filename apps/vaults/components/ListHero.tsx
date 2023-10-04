import {useMemo, useState} from 'react';
import {Switch as HeadlessSwitch} from '@headlessui/react';
import {IconArbitrumChain} from '@yearn-finance/web-lib/icons/chains/IconArbitrumChain';
import {IconBaseChain} from '@yearn-finance/web-lib/icons/chains/IconBaseChain';
import {IconEtherumChain} from '@yearn-finance/web-lib/icons/chains/IconEtherumChain';
import {IconFantomChain} from '@yearn-finance/web-lib/icons/chains/IconFantomChain';
import {IconOptimismChain} from '@yearn-finance/web-lib/icons/chains/IconOptimismChain';
import {MultiSelectDropdown} from '@common/components/MultiSelectDropdown';
import {SearchBar} from '@common/components/SearchBar';

import type {ChangeEvent, ReactElement} from 'react';
import type {TMultiSelectOptionProps} from '@common/components/MultiSelectDropdown';

type TSwitchProps = {
	isEnabled: boolean;
	onSwitch?: (state: boolean) => void;
};

type TListHero = {
	switchProps?: TSwitchProps;
	categories: string;
	selectedChains: string;
	searchValue: string;
	set_categories: (categories: string) => void;
	set_selectedChains: (chains: string) => void;
	set_searchValue: (searchValue: string) => void;
};

function Switch(props: TSwitchProps): ReactElement {
	const {isEnabled, onSwitch} = props;
	const [isEnabledState, set_isEnabledState] = useState(isEnabled);

	function safeOnSwitch(): void {
		if (onSwitch) {
			onSwitch(!isEnabled);
		} else {
			set_isEnabledState(!isEnabledState);
		}
	}

	return (
		<div>
			<HeadlessSwitch
				checked={onSwitch ? isEnabled : isEnabledState}
				onChange={safeOnSwitch}
				onKeyDown={({keyCode}: {keyCode: number}): unknown => (keyCode === 13 ? safeOnSwitch() : null)}
				className={'yearn--next-switch'}>
				<span className={'sr-only'}>{'Use setting'}</span>
				<div
					aria-hidden={'true'}
					className={(onSwitch ? isEnabled : isEnabledState) ? 'translate-x-[14px]' : 'translate-x-0'}
				/>
			</HeadlessSwitch>
		</div>
	);
}

export function ListHero({categories, set_categories, searchValue, selectedChains, set_searchValue, set_selectedChains, switchProps}: TListHero): ReactElement {
	const chainOptions = useMemo((): TMultiSelectOptionProps[] => {
		const chainsFromJSON = JSON.parse(selectedChains || '[]') as number[];
		return [
			{
				label: 'Ethereum',
				value: 1,
				isSelected: chainsFromJSON.includes(1),
				icon: <IconEtherumChain />
			},
			{
				label: 'OP Mainnet',
				value: 10,
				isSelected: chainsFromJSON.includes(10),
				icon: <IconOptimismChain />
			},
			{
				label: 'Fantom',
				value: 250,
				isSelected: chainsFromJSON.includes(250),
				icon: <IconFantomChain />
			},
			{
				label: 'Base',
				value: 8453,
				isSelected: chainsFromJSON.includes(8453),
				icon: <IconBaseChain />
			},
			{
				label: 'Arbitrum One',
				value: 42161,
				isSelected: chainsFromJSON.includes(42161),
				icon: <IconArbitrumChain />
			}
		];
	}, [selectedChains]);

	const categoryOptions = useMemo((): TMultiSelectOptionProps[] => {
		const chainsFromJSON = JSON.parse(selectedChains || '[]') as number[];
		const categoriesFromJSON = JSON.parse(categories || '[]') as string[];
		const options: TMultiSelectOptionProps[] = [];

		options.push({
			value: 'Holdings',
			label: 'Holdings',
			isSelected: categoriesFromJSON.includes('Holdings')
		});
		// options.push({
		// 	value: 'Featured Vaults',
		// 	label: 'Featured',
		// 	isSelected: categoriesFromJSON.includes('Featured Vaults')
		// });
		options.push({
			value: 'Crypto Vaults',
			label: 'Crypto',
			isSelected: categoriesFromJSON.includes('Crypto Vaults')
		});
		options.push({
			value: 'Stables Vaults',
			label: 'Stables',
			isSelected: categoriesFromJSON.includes('Stables Vaults')
		});
		options.push({
			value: 'Curve Vaults',
			label: 'Curve',
			isSelected: categoriesFromJSON.includes('Curve Vaults')
		});
		options.push({
			value: 'Balancer Vaults',
			label: 'Balancer',
			isSelected: categoriesFromJSON.includes('Balancer Vaults')
		});

		if (chainsFromJSON.includes(10)) {
			options.push({
				value: 'Boosted Vaults',
				label: 'Boosted',
				isSelected: categoriesFromJSON.includes('Boosted Vaults')
			});
			options.push({
				value: 'Velodrome Vaults',
				label: 'Velodrome',
				isSelected: categoriesFromJSON.includes('Velodrome Vaults')
			});
		}

		if (chainsFromJSON.includes(8453)) {
			options.push({
				value: 'Aerodrome Vaults',
				label: 'Aerodrome',
				isSelected: categoriesFromJSON.includes('Aerodrome Vaults')
			});
		}

		return options;
	}, [selectedChains, categories]);

	return (
		<div className={'flex flex-col items-start justify-between space-x-0 px-4 pb-2 pt-4 md:px-10 md:pb-8 md:pt-10'}>
			<div className={'hidden w-full flex-row items-center justify-between space-x-4 md:flex'}>
				<div className={'w-1/3'}>
					<small>{'Filter'}</small>
					<MultiSelectDropdown
						options={categoryOptions}
						placeholder={'Filter list'}
						onSelect={(options): void => {
							const selectedCategories = options.filter((o): boolean => o.isSelected).map((option): string => String(option.value));
							set_categories(JSON.stringify(selectedCategories));
						}}
					/>
				</div>

				<div className={'w-1/3'}>
					<small>{'Select Blockchain'}</small>
					<MultiSelectDropdown
						options={chainOptions}
						placeholder={'Select chain'}
						onSelect={(options): void => {
							const selectedChains = options.filter((o): boolean => o.isSelected).map((option): number => Number(option.value));
							set_selectedChains(JSON.stringify(selectedChains));
						}}
					/>
				</div>

				<div className={'w-1/3'}>
					<small>{'Search'}</small>
					<SearchBar
						searchPlaceholder={'YFI Vault'}
						searchValue={searchValue}
						set_searchValue={set_searchValue}
					/>
				</div>

				{!!switchProps && (
					<div className={'mr-4 mt-7 flex h-full min-w-fit flex-row'}>
						<small className={'mr-2'}>{'Hide gauges with 0 votes'}</small>
						<Switch {...switchProps} />
					</div>
				)}
			</div>

			<div className={'flex w-full flex-row space-x-2 md:hidden md:w-2/3'}>
				<div className={'flex h-8 w-full items-center border border-neutral-0 bg-neutral-0 p-2 md:w-auto'}>
					<div className={'flex h-8 w-full flex-row items-center justify-between px-0 py-2'}>
						<input
							className={'w-full overflow-x-scroll border-none bg-transparent px-0 py-2 text-xs outline-none scrollbar-none'}
							type={'text'}
							placeholder={'Search'}
							value={searchValue}
							onChange={(e: ChangeEvent<HTMLInputElement>): void => set_searchValue(e.target.value)}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
