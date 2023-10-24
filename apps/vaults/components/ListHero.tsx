import {useMemo} from 'react';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {MultiSelectDropdown} from '@common/components/MultiSelectDropdown';
import {SearchBar} from '@common/components/SearchBar';

import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TMultiSelectOptionProps} from '@common/components/MultiSelectDropdown';

type TListHero = {
	categories: string[];
	possibleCategories: TDict<string>;
	chains: number[];
	searchValue: string;
	onChangeCategories: (categories: string[]) => void;
	onChangeChains: (chains: number[]) => void;
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
	const chainOptions = useMemo((): TMultiSelectOptionProps[] => {
		return [
			{
				label: 'Ethereum',
				value: 1,
				isSelected: chains.includes(1),
				icon: (
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_CHAIN_URI}/1/logo-128.png`}
						alt={`Chain 1`}
						width={40}
						height={40}
					/>
				)
			},
			{
				label: 'OP Mainnet',
				value: 10,
				isSelected: chains.includes(10),
				icon: (
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_CHAIN_URI}/10/logo-128.png`}
						alt={`Chain 10`}
						width={40}
						height={40}
					/>
				)
			},
			{
				label: 'Polygon PoS',
				value: 137,
				isSelected: chains.includes(137),
				icon: (
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_CHAIN_URI}/137/logo-128.png`}
						alt={`Chain 137`}
						width={40}
						height={40}
					/>
				)
			},
			{
				label: 'Fantom',
				value: 250,
				isSelected: chains.includes(250),
				icon: (
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_CHAIN_URI}/250/logo-128.png`}
						alt={`Chain 250`}
						width={40}
						height={40}
					/>
				)
			},
			{
				label: 'Base',
				value: 8453,
				isSelected: chains.includes(8453),
				icon: (
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_CHAIN_URI}/8453/logo-128.png`}
						alt={`Chain 8453`}
						width={40}
						height={40}
					/>
				)
			},
			{
				label: 'Arbitrum One',
				value: 42161,
				isSelected: chains.includes(42161),
				icon: (
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_CHAIN_URI}/42161/logo-128.png`}
						alt={`Chain 42161`}
						width={40}
						height={40}
					/>
				)
			}
		];
	}, [chains]);

	const categoryOptions = useMemo((): TMultiSelectOptionProps[] => {
		const options: TMultiSelectOptionProps[] = Object.entries(possibleCategories).map(
			([key, value]): TMultiSelectOptionProps => ({
				value: key,
				label: value,
				isSelected: categories.includes(key)
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
