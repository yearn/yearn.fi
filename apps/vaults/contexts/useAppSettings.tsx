import React, {createContext, memo, useContext, useMemo} from 'react';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';

import {useSessionStorage} from './useSessionStorage';

import type {ReactElement} from 'react';

export type	TAppSettingsContext = {
	category: string;
	searchValue: string;
	shouldHideDust: boolean,
	shouldHideLowTVLVaults: boolean,
	onSwitchHideDust: () => void,
	onSwitchHideLowTVLVaults: () => void,
	set_category: (v: string) => void
	set_searchValue: (v: string) => void
}
const	defaultProps: TAppSettingsContext = {
	category: '',
	searchValue: '',
	shouldHideDust: false,
	shouldHideLowTVLVaults: false,
	onSwitchHideDust: (): void => undefined,
	onSwitchHideLowTVLVaults: (): void => undefined,
	set_category: (): void => undefined,
	set_searchValue: (): void => undefined
};

const	AppSettingsContext = createContext<TAppSettingsContext>(defaultProps);
export const AppSettingsContextApp = memo(function AppSettingsContextApp({children}: {children: ReactElement}): ReactElement {
	const 	[category, set_category] = useSessionStorage('yearnFiFeaturedVaults', 'Featured Vaults');
	const 	[searchValue, set_searchValue] = useSessionStorage('yearnFiSearchValue', '');
	const	[shouldHideDust, set_shouldHideDust] = useLocalStorage('shouldHideDust', true);
	const	[shouldHideLowTVLVaults, set_shouldHideLowTVLVaults] = useLocalStorage('shouldHideLowTVLVaults', false);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TAppSettingsContext => ({
		shouldHideDust,
		onSwitchHideDust: (): void => set_shouldHideDust(!shouldHideDust),
		shouldHideLowTVLVaults,
		onSwitchHideLowTVLVaults: (): void => set_shouldHideLowTVLVaults(!shouldHideLowTVLVaults),
		category,
		searchValue,
		set_category,
		set_searchValue
	}), [shouldHideDust, shouldHideLowTVLVaults, category, searchValue, set_category, set_searchValue, set_shouldHideDust, set_shouldHideLowTVLVaults]);

	return (
		<AppSettingsContext.Provider value={contextValue}>
			{children}
		</AppSettingsContext.Provider>
	);
});

export const useAppSettings = (): TAppSettingsContext => useContext(AppSettingsContext);
export default useAppSettings;