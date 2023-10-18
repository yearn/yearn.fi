import {useEffect, useState} from 'react';
import {StringParam, useQueryParam} from 'use-query-params';

type TQueryArgs = {
	search: string | null | undefined;
	onSearch: (value: string) => void;
};
function useQueryArguments(): TQueryArgs {
	const [searchParam, set_searchParam] = useQueryParam('search', StringParam);
	const [search, set_search] = useState(searchParam);

	/** 🔵 - Yearn *********************************************************************************
	 **	This useEffect hook is used to synchronize the search state with the query parameter
	 *********************************************************************************************/
	useEffect((): void => {
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

	return {
		search,
		onSearch: set_search
	};
}

export {useQueryArguments};
