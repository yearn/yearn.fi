import {useCallback, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useRouter} from 'next/router';
import {useDeepCompareEffect, useMountEffect} from '@react-hookz/web';
import {useSupportedChains} from '@common/hooks/useChains';

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
function useQueryArguments({defaultCategories}: {defaultCategories?: string[]}): TQueryArgs {
	const allChains = useSupportedChains().map((chain): number => chain.id);
	const searchParams = useSearchParams();
	const router = useRouter();
	const [search, set_search] = useState<string | null>(null);
	const [categories, set_categories] = useState<string[]>(defaultCategories || []);
	const [chains, set_chains] = useState<number[]>([]);
	const [sortDirection, set_sortDirection] = useState<string | null>(null);
	const [sortBy, set_sortBy] = useState<string | null>(null);

	const handleQuery = useCallback(
		(_searchParams: URLSearchParams): void => {
			if (_searchParams.has('search')) {
				const _search = _searchParams.get('search');
				if (_search === null) {
					return;
				}
				set_search(_search);
			}

			if (_searchParams.has('categories')) {
				const categoriesParam = _searchParams.get('categories');
				const categoriesParamArray = categoriesParam?.split('_') || [];
				if (categoriesParamArray.length === 0) {
					set_categories(defaultCategories || []);
					return;
				}
				set_categories(categoriesParamArray);
			} else {
				set_categories(defaultCategories || []);
			}

			if (_searchParams.has('chains')) {
				const chainsParam = _searchParams.get('chains');
				const chainsParamArray = chainsParam?.split('_') || [];
				if (chainsParamArray.length === 0) {
					set_chains(allChains);
					return;
				}
				set_chains(chainsParamArray.map((chain): number => Number(chain)));
			} else {
				set_chains(allChains);
			}

			if (_searchParams.has('sortDirection')) {
				const _sortDirection = _searchParams.get('sortDirection');
				if (_sortDirection === null) {
					return;
				}
				set_sortDirection(_sortDirection);
			}

			if (_searchParams.has('sortBy')) {
				const _sortBy = _searchParams.get('sortBy');
				if (_sortBy === null) {
					return;
				}
				set_sortDirection(_sortBy);
			}
		},
		[defaultCategories, allChains]
	);

	useMountEffect((): void | VoidFunction => {
		const currentPage = new URL(window.location.href);
		handleQuery(new URLSearchParams(currentPage.search));
	});

	useDeepCompareEffect((): void | VoidFunction => {
		handleQuery(searchParams);
	}, [searchParams]);

	return {
		search,
		categories: (categories || defaultCategories || []) as string[],
		chains: (chains || allChains) as number[],
		sortDirection: (sortDirection || 'desc') as TSortDirection,
		sortBy: (sortBy || 'featuringScore') as TPossibleSortBy,
		onSearch: (value): void => {
			set_search(value);
			const currentURL = new URL(window.location.href);
			if (value === '') {
				currentURL.searchParams.delete('search');
				router.replace(currentURL, {search: currentURL.search}, {shallow: true});
				return;
			}
			currentURL.searchParams.set('search', value);
			router.replace(currentURL, {search: currentURL.search}, {shallow: true});
		},
		onChangeCategories: (value): void => {
			set_categories(value);
			const currentURL = new URL(window.location.href);
			if (value.length === 0) {
				currentURL.searchParams.delete('categories');
				router.replace(currentURL, {search: currentURL.search}, {shallow: true});
				return;
			}
			currentURL.searchParams.set('categories', value.join('_'));
			router.replace(currentURL, {search: currentURL.search}, {shallow: true});
		},
		onChangeChains: (value): void => {
			set_chains(value);
			const currentURL = new URL(window.location.href);
			if (value.length === 0) {
				currentURL.searchParams.delete('chains');
				router.replace(currentURL, {search: currentURL.search}, {shallow: true});
				return;
			}
			currentURL.searchParams.set('chains', value.join('_'));
			router.replace(currentURL, {search: currentURL.search}, {shallow: true});
		},
		onChangeSortDirection: (value): void => {
			set_sortDirection(value);
			const currentURL = new URL(window.location.href);
			if (value === '') {
				currentURL.searchParams.delete('sortDirection');
				router.replace(currentURL, {search: currentURL.search}, {shallow: true});
				return;
			}
			currentURL.searchParams.set('sortDirection', value);
			router.replace(currentURL, {search: currentURL.search}, {shallow: true});
		},
		onChangeSortBy: (value): void => {
			set_sortBy(value);
			const currentURL = new URL(window.location.href);
			if (value === undefined) {
				currentURL.searchParams.delete('sortBy');
				router.replace(currentURL, {search: currentURL.search}, {shallow: true});
				return;
			}
			currentURL.searchParams.set('sortBy', value);
			router.replace(currentURL, {search: currentURL.search}, {shallow: true});
		}
	};
}

export {useQueryArguments};
