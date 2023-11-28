import {useCallback, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useRouter} from 'next/router';
import {useDeepCompareEffect, useMountEffect} from '@react-hookz/web';
import {useSupportedChains} from '@common/hooks/useChains';

import type {TSortDirection} from '@common/types/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

type TQueryArgs = {
	search: string | null | undefined;
	categories: string[] | null;
	chains: number[] | null;
	sortDirection: TSortDirection;
	sortBy: TPossibleSortBy;
	onSearch: (value: string) => void;
	onChangeCategories: (value: string[] | null) => void;
	onChangeChains: (value: number[] | null) => void;
	onChangeSortDirection: (value: TSortDirection) => void;
	onChangeSortBy: (value: TPossibleSortBy) => void;
};
function useQueryArguments({defaultCategories}: {defaultCategories?: string[]}): TQueryArgs {
	const allChains = useSupportedChains().map((chain): number => chain.id);
	const searchParams = useSearchParams();
	const router = useRouter();
	const [search, set_search] = useState<string | null>(null);
	const [categories, set_categories] = useState<string[] | null>(defaultCategories || []);
	const [chains, set_chains] = useState<number[] | null>(allChains || []);
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
				if (categoriesParamArray.length === defaultCategories?.length) {
					const isEqual = categoriesParamArray.every((c): boolean => defaultCategories?.includes(c));
					if (isEqual) {
						set_categories(defaultCategories);
						return;
					}
				}
				if (categoriesParamArray[0] === 'none') {
					set_categories([]);
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
				if (chainsParamArray.length === allChains.length) {
					const isEqual = chainsParamArray.every((c): boolean => allChains.includes(Number(c)));
					if (isEqual) {
						set_chains(allChains);
						return;
					}
				}
				if (chainsParamArray[0] === '0') {
					set_chains([]);
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
		categories: (categories || []) as string[],
		chains: (chains || []) as number[],
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
			if (value === null) {
				const currentURL = new URL(window.location.href);
				currentURL.searchParams.set('categories', 'none');
				router.replace(currentURL, {search: currentURL.search}, {shallow: true});
				return;
			}
			set_categories(value);
			const currentURL = new URL(window.location.href);
			if (value.length === 0) {
				currentURL.searchParams.set('categories', 'none');
				router.replace(currentURL, {search: currentURL.search}, {shallow: true});
				return;
			}
			if (value.length === defaultCategories?.length) {
				const isEqual = value.every((category): boolean => defaultCategories?.includes(category));
				if (isEqual) {
					currentURL.searchParams.delete('categories');
					router.replace(currentURL, {search: currentURL.search}, {shallow: true});
					return;
				}
			}
			currentURL.searchParams.set('categories', value.join('_'));
			router.replace(currentURL, {search: currentURL.search}, {shallow: true});
		},
		onChangeChains: (value): void => {
			if (value === null) {
				const currentURL = new URL(window.location.href);
				currentURL.searchParams.set('chains', '0');
				router.replace(currentURL, {search: currentURL.search}, {shallow: true});
				return;
			}
			set_chains(value);
			const currentURL = new URL(window.location.href);
			if (value.length === 0) {
				currentURL.searchParams.set('chains', '0');
				router.replace(currentURL, {search: currentURL.search}, {shallow: true});
				return;
			}
			if (value.length === allChains.length) {
				const isEqual = value.every((chain): boolean => allChains.includes(chain));
				if (isEqual) {
					currentURL.searchParams.delete('chains');
					router.replace(currentURL, {search: currentURL.search}, {shallow: true});
					return;
				}
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
