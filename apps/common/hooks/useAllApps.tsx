import {useMemo} from 'react';
import {VaultsHeader} from '@vaults/components/header/VaultsHeader';
import {AppName, APPS} from '@common/components/Apps';
import {YBribeHeader} from '@yBribe/components/header/YBribeHeader';
import {YCrvHeader} from '@yCRV/components/header/YCrvHeader';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/layouts/Header.next';

type TAllApps = {
    menu: TMenu[];
    headers: {
        vaults: ReactElement;
        yBribe: ReactElement;
        yCrv: ReactElement;
    };
    menus: {
        vaults: TMenu[];
        yBribe: TMenu[];
        yCrv: TMenu[];
    };
    supportedNetworks: number[];
};

export function useAllApps(pathname: NextRouter['pathname']): TAllApps {
	return {
		menu: useMemo((): TMenu[] => {
			const HOME_MENU = {path: '/', label: 'Home'};
			
			if (pathname.startsWith('/ycrv')) {
				return [HOME_MENU, ...APPS[AppName.YCRV].menu];
			}

			if (pathname.startsWith('/vaults')) {
				return [HOME_MENU, ...APPS[AppName.VAULTS].menu];
			}
            
			if (pathname.startsWith('/ybribe')) {
				return [HOME_MENU, ...APPS[AppName.YBRIBE].menu];
			}
			return [
				HOME_MENU,
				{path: 'https://gov.yearn.finance/', label: 'Governance', target: '_blank'},
				{path: 'https://blog.yearn.finance/', label: 'Blog', target: '_blank'},
				{path: 'https://docs.yearn.finance/', label: 'Docs', target: '_blank'}
			];
		}, [pathname]),
		menus: {
			vaults: APPS[AppName.VAULTS].menu,
			yBribe: APPS[AppName.YBRIBE].menu,
			yCrv: APPS[AppName.YCRV].menu
		},
		headers: {
			vaults: <VaultsHeader pathname={pathname} />,
			yBribe: <YBribeHeader />,
			yCrv: <YCrvHeader />

		},
		supportedNetworks: useMemo((): number[] => {
			if (pathname.startsWith('/ycrv') || pathname.startsWith('/ybribe')) {
				return [1];
			}

			return [1, 10, 250, 42161];
		}, [pathname])
	};
}
