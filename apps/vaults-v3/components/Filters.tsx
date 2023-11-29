import {useMemo} from 'react';
import {VaultListOptions} from '@vaults/components/list/VaultListOptions';
import {ALL_VAULTSV3_CATEGORIES} from '@vaults-v3/constants';
import {MultiSelectDropdown} from '@common/components/MultiSelectDropdown';
import {SearchBar} from '@common/components/SearchBar';
import {useChainOptions} from '@common/hooks/useChains';

import type {ReactElement} from 'react';
import type {TMultiSelectOptionProps} from '@common/components/MultiSelectDropdown';

type TListHero = {
	categories: string[] | null;
	chains: number[] | null;
	searchValue: string;
	onChangeCategories: (categories: string[] | null) => void;
	onChangeChains: (chains: number[] | null) => void;
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
	const chainOptions = useChainOptions(chains);
	const categoryOptions = useMemo((): TMultiSelectOptionProps[] => {
		const options: TMultiSelectOptionProps[] = Object.entries(ALL_VAULTSV3_CATEGORIES).map(
			([key, value]): TMultiSelectOptionProps => ({
				value: key,
				label: value.replaceAll(' Vaults', ''),
				isSelected: categories?.includes(key) || false
			})
		);
		return options;
	}, [categories]);

	return (
		<div className={'relative col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-6'}>
			<strong className={'block pb-2 text-3xl font-black text-neutral-900 md:pb-4 md:text-4xl md:leading-[48px]'}>
				{'Filters'}
			</strong>

			<div className={'absolute right-10 top-10'}>
				<VaultListOptions panelClassName={'bg-neutral-300 rounded-lg'} />
			</div>

			<div className={'mb-5 w-full'}>
				<p className={'pb-2 text-[#757CA6]'}>{'Search'}</p>
				<SearchBar
					className={'max-w-none rounded-lg border-none bg-neutral-300 text-neutral-900 md:w-full'}
					iconClassName={'text-neutral-900'}
					searchPlaceholder={'YFI Vault'}
					searchValue={searchValue}
					onSearch={onSearch}
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
					<p className={'pb-2 text-[#757CA6]'}>{'Select Type'}</p>
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
