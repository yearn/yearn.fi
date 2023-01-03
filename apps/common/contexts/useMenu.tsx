import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {ModalMobileMenu} from '@yearn-finance/web-lib/components/ModalMobileMenu';
import {AppName, APPS} from '@common/components/Apps';

import type {ReactElement} from 'react';

export type TCurrentMenu = {
	app: {
		path: string;
		label: ReactElement | string;
	}[],
	isOpen: boolean,
}
export type TMenu = {
	menu: TCurrentMenu,
	onOpenMenu: () => void,
}
const	defaultProps: TMenu = {
	menu: {
		app: [],
		isOpen: false
	},
	onOpenMenu: (): void => undefined
};

const	MenuContext = createContext<TMenu>(defaultProps);
export const MenuContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const	{pathname} = useRouter();
	const	[menu, set_menu] = useState<TCurrentMenu>(defaultProps.menu);

	const onOpenMenu = useCallback((): void => {
		if (pathname.startsWith('/ycrv')) {
			set_menu({app: APPS[AppName.YCRV].menu, isOpen: true});
		} else if (pathname.startsWith('/vaults')) {
			set_menu({app: APPS[AppName.VAULTS].menu, isOpen: true});
		} else if (pathname.startsWith('/ybribe')) {
			set_menu({app: APPS[AppName.YBRIBE].menu, isOpen: true});
		} else {
			set_menu({
				app: [
					{path: '/', label: 'Home'},
					{path: 'https://gov.yearn.finance/', label: 'Governance'},
					{path: 'https://blog.yearn.finance/', label: 'Blog'},
					{path: 'https://docs.yearn.finance/', label: 'Docs'}
				],
				isOpen: true
			});
		}

	}, [pathname]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TMenu => ({
		menu,
		onOpenMenu
	}), [menu, onOpenMenu]);

	return (
		<MenuContext.Provider value={contextValue}>
			{children}
			<ModalMobileMenu
				shouldUseWallets={true}
				shouldUseNetworks={true}
				isOpen={menu.isOpen}
				onClose={(): void => set_menu(defaultProps.menu)}>
				{(menu?.app || [])?.map((option): ReactElement => (
					<Link key={option.path} href={option.path}>
						<div
							className={'mobile-nav-item'}
							onClick={(): void => set_menu(defaultProps.menu)}>
							<p className={'font-bold'}>
								{option.label}
							</p>
						</div>
					</Link>
				))}
			</ModalMobileMenu>
		</MenuContext.Provider>
	);
};


export const useMenu = (): TMenu => useContext(MenuContext);
export default useMenu;
