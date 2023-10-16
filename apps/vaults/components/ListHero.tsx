import {useMemo} from 'react';
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
	categories: string;
	selectedChains: string;
	searchValue: string;
	set_categories: (categories: string) => void;
	set_selectedChains: (chains: string) => void;
	set_searchValue: (searchValue: string) => void;
};

export function ListHero({categories, set_categories, searchValue, selectedChains, set_searchValue, set_selectedChains}: TListHero): ReactElement {
	const chainsFromJSON = useMemo((): number[] => JSON.parse(selectedChains || '[]') as number[], [selectedChains]);
	const categoriesFromJSON = useMemo((): string[] => JSON.parse(categories || '[]') as string[], [categories]);

	const chainOptions = useMemo((): TMultiSelectOptionProps[] => {
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
	}, [chainsFromJSON]);

	const categoryOptions = useMemo((): TMultiSelectOptionProps[] => {
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
		options.push({
			value: 'Aerodrome Vaults',
			label: 'Aerodrome',
			isSelected: categoriesFromJSON.includes('Aerodrome Vaults')
		});

		return options;
	}, [categoriesFromJSON]);

	return (
		<div className={'flex flex-col items-start justify-between space-x-0 px-4 pb-2 pt-4 md:px-10 md:pb-8 md:pt-10'}>
			<div className={'mt-0 flex w-full flex-col items-center justify-between gap-4 md:mt-0 md:flex-row'}>
				<div className={'w-full md:w-1/3'}>
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

				<div className={'w-full md:w-1/3'}>
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

				<div className={'w-full md:w-1/3'}>
					<small>{'Search'}</small>
					<SearchBar
						className={'md:w-full'}
						searchPlaceholder={'YFI Vault'}
						searchValue={searchValue}
						set_searchValue={set_searchValue}
					/>
				</div>
			</div>
		</div>
	);
}
