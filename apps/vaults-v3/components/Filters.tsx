import {useMemo} from 'react';
import {VaultListOptions} from '@vaults/components/list/VaultListOptions';
import {ALL_CATEGORIES} from '@vaults/constants';
import {IconArbitrumChain} from '@yearn-finance/web-lib/icons/chains/IconArbitrumChain';
import {IconBaseChain} from '@yearn-finance/web-lib/icons/chains/IconBaseChain';
import {IconEtherumChain} from '@yearn-finance/web-lib/icons/chains/IconEtherumChain';
import {IconFantomChain} from '@yearn-finance/web-lib/icons/chains/IconFantomChain';
import {IconOptimismChain} from '@yearn-finance/web-lib/icons/chains/IconOptimismChain';
import {MultiSelectDropdown} from '@common/components/MultiSelectDropdown';
import {SearchBar} from '@common/components/SearchBar';

import type {ReactElement} from 'react';
import type {TMultiSelectOptionProps} from '@common/components/MultiSelectDropdown';

type TListHero = {
	categories: string[];
	chains: number[];
	searchValue: string;
	onChangeCategories: (categories: string[]) => void;
	onChangeChains: (chains: number[]) => void;
	onSearch: (searchValue: string) => void;
};

export function Filters({
	categories,
	onChangeCategories,
	searchValue,
	chains,
	onSearch,
	onChangeChains
}: TListHero): ReactElement {
	const chainOptions = useMemo((): TMultiSelectOptionProps[] => {
		return [
			{
				label: 'Ethereum',
				value: 1,
				isSelected: chains.includes(1),
				icon: <IconEtherumChain />
			},
			{
				label: 'OP Mainnet',
				value: 10,
				isSelected: chains.includes(10),
				icon: <IconOptimismChain />
			},
			{
				label: 'Fantom',
				value: 250,
				isSelected: chains.includes(250),
				icon: <IconFantomChain />
			},
			{
				label: 'Base',
				value: 8453,
				isSelected: chains.includes(8453),
				icon: <IconBaseChain />
			},
			{
				label: 'Arbitrum One',
				value: 42161,
				isSelected: chains.includes(42161),
				icon: <IconArbitrumChain />
			}
		];
	}, [chains]);

	const categoryOptions = useMemo((): TMultiSelectOptionProps[] => {
		const options: TMultiSelectOptionProps[] = Object.entries(ALL_CATEGORIES).map(
			([key, value]): TMultiSelectOptionProps => ({
				value: key,
				label: value,
				isSelected: categories.includes(key)
			})
		);
		return options;
	}, [categories]);

	return (
		<div className={'relative col-span-12 w-full rounded-3xl bg-neutral-0 p-6 md:col-span-6'}>
			<strong className={'block pb-2 text-lg font-black text-neutral-900 md:pb-6 md:text-4xl md:leading-[48px]'}>
				{'Filters'}
			</strong>

			<div className={'absolute right-5 top-3 md:right-8 md:top-8'}>
				<VaultListOptions panelClassName={'bg-neutral-100 rounded-lg'} />
			</div>

			<div className={'mb-5 w-full'}>
				<p className={'pb-2 text-[#757CA6]'}>{'Search'}</p>
				<SearchBar
					className={'max-w-none rounded-lg bg-neutral-300 text-neutral-900 md:w-full'}
					iconClassName={'text-neutral-900'}
					searchPlaceholder={'YFI Vault'}
					searchValue={searchValue}
					set_searchValue={onSearch}
				/>
			</div>
			<div className={'grid grid-cols-2 gap-x-6'}>
				<div className={'w-full'}>
					<p className={'pb-2 text-[#757CA6]'}>{'Select Blockchain'}</p>
					<MultiSelectDropdown
						buttonClassName={'max-w-none rounded-lg bg-neutral-300 text-neutral-900 md:w-full'}
						comboboxOptionsClassName={'bg-neutral-300 rounded-lg'}
						options={chainOptions}
						placeholder={'Select chain'}
						onSelect={(options): void => {
							const selectedChains = options
								.filter((o): boolean => o.isSelected)
								.map((option): number => Number(option.value));
							onChangeChains(selectedChains);
						}}
					/>
				</div>
				<div className={'w-full'}>
					<p className={'pb-2 text-[#757CA6]'}>{'Filter'}</p>
					<MultiSelectDropdown
						buttonClassName={'max-w-none rounded-lg bg-neutral-300 text-neutral-900 md:w-full'}
						comboboxOptionsClassName={'bg-neutral-300 rounded-lg'}
						options={categoryOptions}
						placeholder={'Filter list'}
						onSelect={(options): void => {
							const selectedCategories = options
								.filter((o): boolean => o.isSelected)
								.map((option): string => String(option.value));
							onChangeCategories(selectedCategories);
						}}
					/>
				</div>
			</div>
		</div>
	);
}
