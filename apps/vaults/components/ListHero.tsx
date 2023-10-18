import {useMemo} from 'react';
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

export function ListHero({
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
		<div className={'flex flex-col items-start justify-between space-x-0 px-4 pb-2 pt-4 md:px-10 md:pb-8 md:pt-10'}>
			<div className={'mt-0 flex w-full flex-col items-center justify-between gap-4 md:mt-0 md:flex-row'}>
				<div className={'w-full md:w-1/3'}>
					<small>{'Select Blockchain'}</small>
					<MultiSelectDropdown
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

				<div className={'w-full md:w-1/3'}>
					<small>{'Filter'}</small>
					<MultiSelectDropdown
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

				<div className={'w-full md:w-1/3'}>
					<small>{'Search'}</small>
					<SearchBar
						className={'md:w-full'}
						searchPlaceholder={'YFI Vault'}
						searchValue={searchValue}
						set_searchValue={onSearch}
					/>
				</div>
			</div>
		</div>
	);
}
