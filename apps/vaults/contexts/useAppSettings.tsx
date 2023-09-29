import {createContext, memo, useContext, useMemo} from 'react';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';
import {useSessionStorage} from '@yearn-finance/web-lib/hooks/useSessionStorage';

import type {ReactElement} from 'react';

export type TAppSettingsContext = {
	category: string;
	selectedChains: string;
	searchValue: string;
	shouldHideDust: boolean,
	shouldHideLowTVLVaults: boolean,
	onSwitchHideDust: VoidFunction,
	onSwitchHideLowTVLVaults: VoidFunction,
	set_category: (v: string) => void
	set_searchValue: (v: string) => void
	set_selectedChains: (v: string) => void
}
const defaultProps: TAppSettingsContext = {
	category: '',
	selectedChains: '[1]',
	searchValue: '',
	shouldHideDust: false,
	shouldHideLowTVLVaults: false,
	onSwitchHideDust: (): void => undefined,
	onSwitchHideLowTVLVaults: (): void => undefined,
	set_category: (): void => undefined,
	set_searchValue: (): void => undefined,
	set_selectedChains: (): void => undefined
};

const AppSettingsContext = createContext<TAppSettingsContext>(defaultProps);
export const AppSettingsContextApp = memo(function AppSettingsContextApp({
	children
}: {
	children: ReactElement;
}): ReactElement {
	const [category, set_category] = useSessionStorage('yearn.fi/vaults-category', 'All Vaults');
	const [searchValue, set_searchValue] = useSessionStorage('yearn.fi/vaults-search', '');
	const [selectedChains, set_selectedChains] = useSessionStorage('yearn.fi/selected-chains', '[1]');
	const [shouldHideDust, set_shouldHideDust] = useLocalStorage('yearn.fi/should-hide-dust', false);
	const [shouldHideLowTVLVaults, set_shouldHideLowTVLVaults] = useLocalStorage('yearn.fi/hide-low-tvl', false);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const contextValue = useMemo((): TAppSettingsContext => ({
		shouldHideDust,
		onSwitchHideDust: (): void => set_shouldHideDust(!shouldHideDust),
		shouldHideLowTVLVaults,
		onSwitchHideLowTVLVaults: (): void => set_shouldHideLowTVLVaults(!shouldHideLowTVLVaults),
		category,
		selectedChains,
		searchValue,
		set_category,
		set_searchValue,
		set_selectedChains
	}), [shouldHideDust, shouldHideLowTVLVaults, category, searchValue, set_category, set_searchValue, set_shouldHideDust, set_shouldHideLowTVLVaults]);

	return (
		<AppSettingsContext.Provider value={contextValue}>
			{children}
		</AppSettingsContext.Provider>
	);

	return <AppSettingsContext.Provider value={contextValue}>{children}</AppSettingsContext.Provider>;
});

export const useAppSettings = (): TAppSettingsContext => useContext(AppSettingsContext);
