import {createContext, memo, useContext, useMemo} from 'react';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';
import {useSessionStorage} from '@yearn-finance/web-lib/hooks/useSessionStorage';

import type {ReactElement} from 'react';

export const ALL_CATEGORIES = {
	holdings: 'Holdings',
	crypto: 'Crypto Vaults',
	stables: 'Stables Vaults',
	curve: 'Curve Vaults',
	balancer: 'Balancer Vaults',
	boosted: 'Boosted Vaults',
	velodrome: 'Velodrome Vaults',
	aerodrome: 'Aerodrome Vaults'
};
export const ALL_CATEGORIES_KEYS = Object.keys(ALL_CATEGORIES);
export const ALL_CHAINS = [1, 10, 250, 8453, 42161];

export type TAppSettingsContext = {
	searchValue: string;
	shouldHideDust: boolean;
	shouldHideLowTVLVaults: boolean;
	onSwitchHideDust: VoidFunction;
	onSwitchHideLowTVLVaults: VoidFunction;
	set_searchValue: (v: string) => void;
};
const defaultProps: TAppSettingsContext = {
	searchValue: '',
	shouldHideDust: false,
	shouldHideLowTVLVaults: false,
	onSwitchHideDust: (): void => undefined,
	onSwitchHideLowTVLVaults: (): void => undefined,
	set_searchValue: (): void => undefined
};

const AppSettingsContext = createContext<TAppSettingsContext>(defaultProps);
export const AppSettingsContextApp = memo(function AppSettingsContextApp({
	children
}: {
	children: ReactElement;
}): ReactElement {
	/**
	 * @deprecated Use use-query-params instead
	 */
	const [searchValue, set_searchValue] = useSessionStorage('yearn.fi/vaults-search@0.0.1', '');
	const [shouldHideDust, set_shouldHideDust] = useLocalStorage('yearn.fi/should-hide-dust@0.0.1', false);
	const [shouldHideLowTVLVaults, set_shouldHideLowTVLVaults] = useLocalStorage('yearn.fi/hide-low-tvl@0.0.1', false);

	/* 🔵 - Yearn Finance ******************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useMemo(
		(): TAppSettingsContext => ({
			shouldHideDust,
			onSwitchHideDust: (): void => set_shouldHideDust(!shouldHideDust),
			shouldHideLowTVLVaults,
			onSwitchHideLowTVLVaults: (): void => set_shouldHideLowTVLVaults(!shouldHideLowTVLVaults),
			searchValue,
			set_searchValue
		}),
		[
			shouldHideDust,
			shouldHideLowTVLVaults,
			searchValue,
			set_searchValue,
			set_shouldHideDust,
			set_shouldHideLowTVLVaults
		]
	);

	return <AppSettingsContext.Provider value={contextValue}>{children}</AppSettingsContext.Provider>;
});

export const useAppSettings = (): TAppSettingsContext => useContext(AppSettingsContext);
