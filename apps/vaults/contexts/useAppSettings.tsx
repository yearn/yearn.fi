import React, {createContext, memo, useContext, useMemo} from 'react';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';

import type {ReactElement} from 'react';

export type	TAppSettingsContext = {
	shouldHideDust: boolean,
	shouldHideLowTVLVaults: boolean,
	onSwitchHideDust: () => void,
	onSwitchHideLowTVLVaults: () => void,
}
const	defaultProps: TAppSettingsContext = {
	shouldHideDust: false,
	shouldHideLowTVLVaults: false,
	onSwitchHideDust: (): void => undefined,
	onSwitchHideLowTVLVaults: (): void => undefined
};

const	AppSettingsContext = createContext<TAppSettingsContext>(defaultProps);
export const AppSettingsContextApp = memo(function AppSettingsContextApp({children}: {children: ReactElement}): ReactElement {
	const	[shouldHideDust, set_shouldHideDust] = useLocalStorage('shouldHideDust', true);
	const	[shouldHideLowTVLVaults, set_shouldHideLowTVLVaults] = useLocalStorage('shouldHideLowTVLVaults', false);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TAppSettingsContext => ({
		shouldHideDust,
		onSwitchHideDust: (): void => set_shouldHideDust(!shouldHideDust),
		shouldHideLowTVLVaults,
		onSwitchHideLowTVLVaults: (): void => set_shouldHideLowTVLVaults(!shouldHideLowTVLVaults)
	}), [shouldHideDust, shouldHideLowTVLVaults, set_shouldHideDust, set_shouldHideLowTVLVaults]);

	return (
		<AppSettingsContext.Provider value={contextValue}>
			{children}
		</AppSettingsContext.Provider>
	);
});

export const useAppSettings = (): TAppSettingsContext => useContext(AppSettingsContext);
export default useAppSettings;