import {createContext, useContext, useReducer} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {optionalRenderProps} from '@common/types/optionalRenderProps';

import type {Dispatch, ReactElement} from 'react';
import type {TOptionalRenderProps} from '@common/types/optionalRenderProps';

type TSearchContext = {
	configuration: TSearchConfiguration;
	dispatch: Dispatch<TSearchActions>;
};

type TSearchConfiguration = {
	searchValue: string;
};

type TSearchActions = {
	type: 'SET_SEARCH';
	payload: string;
};

const defaultProps = {
	configuration: {
		searchValue: ''
	},
	dispatch: (): void => undefined
};

const configurationReducer = (state: TSearchConfiguration, action: TSearchActions): TSearchConfiguration => {
	switch (action.type) {
		case 'SET_SEARCH':
			return {...state, searchValue: action.payload};
	}
};

const SearchContext = createContext<TSearchContext>(defaultProps);
export const SearchContextApp = ({
	children
}: {
	children: TOptionalRenderProps<TSearchContext, ReactElement>;
}): ReactElement => {
	const [configuration, dispatch] = useReducer(configurationReducer, defaultProps.configuration);

	const contextValue = useDeepCompareMemo((): TSearchContext => ({configuration, dispatch}), [configuration]);

	return (
		<SearchContext.Provider value={contextValue}>
			{optionalRenderProps(children, contextValue)}
		</SearchContext.Provider>
	);
};

export const useSearch = (): TSearchContext => {
	const ctx = useContext(SearchContext);
	if (!ctx) {
		throw new Error('SearchContext not found');
	}
	return ctx;
};
