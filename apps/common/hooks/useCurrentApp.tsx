
import {useMemo} from 'react';
import {VeYfiHeader} from 'apps/veyfi/components/header/VeYfiHeader';
import homeManifest from 'public/manifest.json';
import {VaultsHeader} from '@vaults/components/header/VaultsHeader';
import {AppName, APPS} from '@common/components/Apps';
import {YBalHeader} from '@yBal/components/header/YBalHeader';
import {YBribeHeader} from '@yBribe/components/header/YBribeHeader';
import {YCrvHeader} from '@yCRV/components/header/YCrvHeader';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/components/Header';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TMetaFile} from '@common/components/Meta';

type TCurrentApp = {
	name: AppName | 'Home';
	manifest: TMetaFile;
	header?: ReactElement;
	menu: TMenu[];
};

function useCurrentApp({pathname}: NextRouter): TCurrentApp {
	return useMemo((): TCurrentApp => {
		const appMapping: TDict<TCurrentApp> = {
			'/vaults': {...APPS[AppName.VAULTS], header: <VaultsHeader pathname={pathname} />},
			'/ybribe': {...APPS[AppName.YBRIBE], header: <YBribeHeader pathname={pathname} />},
			'/ycrv': {...APPS[AppName.YCRV], header: <YCrvHeader pathname={pathname} />},
			'/ybal': {...APPS[AppName.YBAL], header: <YBalHeader pathname={pathname} />},
			'/veyfi': {...APPS[AppName.VEYFI], header: <VeYfiHeader pathname={pathname} />}
		};

		const currentApp = Object.keys(appMapping).find((path): boolean => pathname.startsWith(path));
		if (currentApp) {
			return appMapping[currentApp];
		}
		return {name: 'Home', manifest: homeManifest, menu: []};
	}, [pathname]);
}

export {useCurrentApp};
