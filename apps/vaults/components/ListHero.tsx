import {useMemo} from 'react';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {MultiSelectDropdown} from '@common/components/MultiSelectDropdown';
import {SearchBar} from '@common/components/SearchBar';
import {useChainOptions} from '@common/hooks/useChains';

import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TMultiSelectOptionProps} from '@common/components/MultiSelectDropdown';

type TListHero = {
	categories: string[] | null;
	possibleCategories: TDict<string>;
	chains: number[] | null;
	searchValue: string;
	onChangeCategories: (categories: string[] | null) => void;
	onChangeChains: (chains: number[] | null) => void;
	onSearch: (searchValue: string) => void;
	shouldHideChainSelector?: boolean;
};

export function ListHero({
	categories,
	onChangeCategories,
	possibleCategories,
	searchValue,
	chains,
	onSearch,
	onChangeChains,
	shouldHideChainSelector
}: TListHero): ReactElement {
	const chainOptions = useChainOptions(chains).filter((option): boolean => option.value !== 137);
	const categoryOptions = useMemo((): TMultiSelectOptionProps[] => {
		const options: TMultiSelectOptionProps[] = Object.entries(possibleCategories).map(
			([key, value]): TMultiSelectOptionProps => ({
				value: key,
				label: value,
				isSelected: categories?.includes(key) || false
			})
		);
		return options;
	}, [categories, possibleCategories]);

	return (
		<div className={'flex flex-col items-start justify-between space-x-0 px-4 pb-2 pt-4 md:px-10 md:pb-8 md:pt-10'}>
			<div className={'mt-0 flex w-full flex-col items-center justify-between gap-4 md:mt-0 md:flex-row'}>
				<div className={cl('w-full md:w-1/3', shouldHideChainSelector ? 'invisible pointer-events-none' : '')}>
					<small>{'Select Blockchain'}</small>
					<MultiSelectDropdown
						options={chainOptions}
						placeholder={'Select chain'}
						onSelect={(options): void => {
							const selectedChains = options
								.filter((o): boolean => o.isSelected)
								.map((option): number => Number(option.value));
							onChangeChains(selectedChains.length === 0 ? null : selectedChains);
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
							onChangeCategories(selectedCategories.length === 0 ? null : selectedCategories);
						}}
					/>
				</div>

				<div className={'w-full md:w-1/3'}>
					<small>{'Search'}</small>
					<SearchBar
						className={'md:w-full'}
						searchPlaceholder={'YFI Vault'}
						searchValue={searchValue}
						onSearch={onSearch}
					/>
				</div>
			</div>
		</div>
	);
}
