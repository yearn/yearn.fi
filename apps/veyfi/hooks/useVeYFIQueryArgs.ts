import {useCallback, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useRouter} from 'next/router';
import {useDeepCompareEffect, useMountEffect} from '@react-hookz/web';

type TQueryArgs = {
	search: string | null | undefined;
	onSearch: (value: string) => void;
};
function useQueryArguments(): TQueryArgs {
	const searchParams = useSearchParams();
	const router = useRouter();
	const [search, set_search] = useState<string | null>(null);

	const handleQuery = useCallback((_searchParams: URLSearchParams): void => {
		if (_searchParams.has('search')) {
			const _search = _searchParams.get('search');
			if (_search === null) {
				return;
			}
			set_search(_search);
		}
	}, []);

	useMountEffect((): void | VoidFunction => {
		const currentPage = new URL(window.location.href);
		handleQuery(new URLSearchParams(currentPage.search));
	});

	useDeepCompareEffect((): void | VoidFunction => {
		handleQuery(searchParams);
	}, [searchParams]);

	return {
		search,
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
		}
	};
}

export {useQueryArguments};
