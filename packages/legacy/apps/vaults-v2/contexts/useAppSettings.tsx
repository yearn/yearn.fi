import {useLocalStorage} from '@lib/hooks/useLocalStorage'
import {useSessionStorage} from '@lib/hooks/useSessionStorage'
import type {ReactElement} from 'react'
import {createContext, memo, useContext, useMemo} from 'react'

export type TAppSettingsContext = {
	searchValue: string
	shouldHideDust: boolean
	shouldHideLowTVLVaults: boolean
	onSwitchHideDust: VoidFunction
	onSwitchHideLowTVLVaults: VoidFunction
	setSearchValue: (v: string) => void
}
const defaultProps: TAppSettingsContext = {
	searchValue: '',
	shouldHideDust: false,
	shouldHideLowTVLVaults: false,
	onSwitchHideDust: (): void => undefined,
	onSwitchHideLowTVLVaults: (): void => undefined,
	setSearchValue: (): void => undefined
}

const AppSettingsContext = createContext<TAppSettingsContext>(defaultProps)
export const AppSettingsContextApp = memo(function AppSettingsContextApp({
	children
}: {
	children: ReactElement
}): ReactElement {
	const [searchValue, setSearchValue] = useSessionStorage('yearn.fi/vaults-search@0.0.1', '')
	const [shouldHideDust, setShouldHideDust] = useLocalStorage('yearn.fi/should-hide-dust@0.0.1', false)
	const [shouldHideLowTVLVaults, setShouldHideLowTVLVaults] = useLocalStorage('yearn.fi/hide-low-tvl@0.0.1', false)

	/* 🔵 - Yearn Finance ******************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useMemo(
		(): TAppSettingsContext => ({
			shouldHideDust,
			onSwitchHideDust: (): void => setShouldHideDust(!shouldHideDust),
			shouldHideLowTVLVaults,
			onSwitchHideLowTVLVaults: (): void => setShouldHideLowTVLVaults(!shouldHideLowTVLVaults),
			searchValue,
			setSearchValue
		}),
		[
			shouldHideDust,
			shouldHideLowTVLVaults,
			searchValue,
			setSearchValue,
			setShouldHideDust,
			setShouldHideLowTVLVaults
		]
	)

	return <AppSettingsContext.Provider value={contextValue}>{children}</AppSettingsContext.Provider>
})

export const useAppSettings = (): TAppSettingsContext => useContext(AppSettingsContext)
