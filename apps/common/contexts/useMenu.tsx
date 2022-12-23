import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {MenuVaultsOptions} from '@vaults/Header';
import {ModalMobileMenu} from '@yearn-finance/web-lib/components/ModalMobileMenu';
import {MenuYCRVOptions} from '@yCRV/Header';

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
	const	router = useRouter();
	const	[menu, set_menu] = useState<TCurrentMenu>(defaultProps.menu);

	const onOpenMenu = useCallback((): void => {
		if (router.pathname.startsWith('/ycrv')) {
			set_menu({app: MenuYCRVOptions, isOpen: true});
		} else if (router.pathname.startsWith('/vaults')) {
			set_menu({app: MenuVaultsOptions, isOpen: true});
		} else if (router.pathname.startsWith('/ybribe')) {
			set_menu({app: MenuYCRVOptions, isOpen: true});
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

	}, [router.pathname]);

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
