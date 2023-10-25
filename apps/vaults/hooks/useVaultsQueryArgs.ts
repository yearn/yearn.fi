import {useEffect, useState} from 'react';
import {DelimitedArrayParam, DelimitedNumericArrayParam, StringParam, useQueryParam} from 'use-query-params';
import {ALL_CHAINS, ALL_VAULTS_CATEGORIES_KEYS} from '@vaults/constants';

import type {TSortDirection} from '@common/types/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

type TQueryArgs = {
	search: string | null | undefined;
	categories: string[];
	chains: number[];
	sortDirection: TSortDirection;
	sortBy: TPossibleSortBy;
	onSearch: (value: string) => void;
	onChangeCategories: (value: string[]) => void;
	onChangeChains: (value: number[]) => void;
	onChangeSortDirection: (value: TSortDirection) => void;
	onChangeSortBy: (value: TPossibleSortBy) => void;
};
function useQueryArguments(): TQueryArgs {
	/** 🔵 - Yearn *********************************************************************************
	 **	Theses elements are not exported, they are just used to keep the state of the query, which
	 ** is slower than the state of the component.
	 *********************************************************************************************/
	const [searchParam, set_searchParam] = useQueryParam('search', StringParam);
	const [categoriesParam, set_categoriesParam] = useQueryParam('categories', DelimitedArrayParam);
	const [chainsParam, set_chainsParam] = useQueryParam('chains', DelimitedNumericArrayParam);
	const [sortDirectionParam, set_sortDirectionParam] = useQueryParam('sortDir', StringParam);
	const [sortByParam, set_sortByParam] = useQueryParam('sortBy', StringParam);

	/** 🔵 - Yearn *********************************************************************************
	 **	Theses are our actual state.
	 *********************************************************************************************/
	const [search, set_search] = useState(searchParam);
	const [categories, set_categories] = useState(categoriesParam);
	const [chains, set_chains] = useState(chainsParam);
	const [sortDirection, set_sortDirection] = useState(sortDirectionParam);
	const [sortBy, set_sortBy] = useState(sortByParam);

	/** 🔵 - Yearn *********************************************************************************
	 **	This useEffect hook is used to synchronize the search state with the query parameter
	 *********************************************************************************************/
	useEffect((): void | VoidFunction => {
		if (searchParam === search) {
			return;
		}
		if (search === undefined && searchParam !== undefined) {
			set_search(searchParam);
			return;
		}
		if (!search) {
			set_searchParam(undefined);
		} else {
			set_searchParam(search);
		}
	}, [searchParam, search, set_searchParam]);

	/** 🔵 - Yearn *********************************************************************************
	 **	This useEffect hook is used to synchronize the categories
	 *********************************************************************************************/
	useEffect((): void => {
		if (categoriesParam === categories) {
			return;
		}
		if (categories === undefined && categoriesParam !== undefined) {
			set_categories(categoriesParam);
			return;
		}
		if (!categories || Object.values(categories).length === ALL_VAULTS_CATEGORIES_KEYS.length) {
			set_categoriesParam(undefined);
		} else {
			set_categoriesParam(categories);
		}
	}, [categoriesParam, categories, set_categoriesParam]);

	/** 🔵 - Yearn *********************************************************************************
	 **	This useEffect hook is used to synchronize the chains
	 *********************************************************************************************/
	useEffect((): void => {
		if (chainsParam === chains) {
			return;
		}
		if (chains === undefined && chainsParam !== undefined) {
			set_chains(chainsParam as number[]);
			return;
		}
		if (!chains || Object.values(chains).length === ALL_CHAINS.length) {
			set_chainsParam(undefined);
		} else {
			set_chainsParam(chains);
		}
	}, [chainsParam, chains, set_chainsParam]);

	/** 🔵 - Yearn *********************************************************************************
	 **	This useEffect hook is used to synchronize the sortDirection
	 *********************************************************************************************/
	useEffect((): void => {
		if (sortDirectionParam === sortDirection) {
			return;
		}
		if (sortDirection === undefined && sortDirectionParam !== undefined) {
			set_sortDirection(sortDirectionParam);
			return;
		}
		if (!sortDirection) {
			set_sortDirectionParam(undefined);
		} else {
			set_sortDirectionParam(sortDirection);
		}
	}, [sortDirectionParam, sortDirection, set_sortDirectionParam]);

	/** 🔵 - Yearn *********************************************************************************
	 **	This useEffect hook is used to synchronize the sortOrder
	 *********************************************************************************************/
	useEffect((): void => {
		if (sortByParam === sortBy) {
			return;
		}
		if (sortBy === undefined && sortByParam !== undefined) {
			set_sortBy(sortByParam);
			return;
		}
		if (!sortBy) {
			set_sortByParam(undefined);
		} else {
			set_sortByParam(sortBy);
		}
	}, [sortByParam, sortBy, set_sortByParam]);

	return {
		search,
		categories: (categories || ALL_VAULTS_CATEGORIES_KEYS) as string[],
		chains: (chains || ALL_CHAINS) as number[],
		sortDirection: (sortDirection || 'desc') as TSortDirection,
		sortBy: (sortBy || 'featuringScore') as TPossibleSortBy,
		onSearch: set_search,
		onChangeCategories: set_categories,
		onChangeChains: set_chains,
		onChangeSortDirection: set_sortDirection,
		onChangeSortBy: set_sortBy
	};
}

export {useQueryArguments};
