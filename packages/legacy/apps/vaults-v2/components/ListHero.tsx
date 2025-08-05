import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { MultiSelectDropdown } from '@lib/components/MultiSelectDropdown'
import { SearchBar } from '@lib/components/SearchBar'
import type { TDict } from '@lib/types'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

type TListHero = {
	categories: string[] | null
	possibleCategories: TDict<string>
	chains: number[] | null
	searchValue: string
	onChangeCategories: (categories: string[] | null) => void
	onChangeChains: (chains: number[] | null) => void
	onSearch: (searchValue: string) => void
	shouldHideChainSelector?: boolean
	chainOptions?: TMultiSelectOptionProps[]
}

export function ListHero({
	categories,
	onChangeCategories,
	possibleCategories,
	searchValue,
	onSearch,
	onChangeChains,
	shouldHideChainSelector,
	chainOptions = []
}: TListHero): ReactElement {
	const categoryOptions = useMemo((): TMultiSelectOptionProps[] => {
		const options: TMultiSelectOptionProps[] = Object.entries(possibleCategories).map(
			([key, value]): TMultiSelectOptionProps => ({
				value: key,
				label: value,
				isSelected: categories?.includes(key) || false
			})
		)
		return options
	}, [categories, possibleCategories])

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
								.map((option): number => Number(option.value))
							onChangeChains(selectedChains.length === 0 ? null : selectedChains)
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
								.map((option): string => String(option.value))
							onChangeCategories(selectedCategories.length === 0 ? null : selectedCategories)
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
	)
}
