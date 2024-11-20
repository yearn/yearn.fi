import {createContext, useContext, useState} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {optionalRenderProps} from '@common/types/optionalRenderProps';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TOptionalRenderProps} from '@common/types/optionalRenderProps';

type TSearchContext = {
	configuration: TSearchConfiguration;
	dispatch: Dispatch<SetStateAction<TSearchConfiguration>>;
};

type TSearchConfiguration = {
	searchValue: string;
};

const defaultProps = {
	configuration: {
		searchValue: ''
	},
	dispatch: (): void => undefined
};

const SearchContext = createContext<TSearchContext>(defaultProps);
export const SearchContextApp = ({
	children
}: {
	children: TOptionalRenderProps<TSearchContext, ReactElement>;
}): ReactElement => {
	const [configuration, set_configuration] = useState(defaultProps.configuration);

	const contextValue = useDeepCompareMemo(
		(): TSearchContext => ({configuration, dispatch: set_configuration}),
		[configuration]
	);

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
