
import {useMemo} from 'react';
import {VeYfiHeader} from 'apps/veyfi/components/header/VeYfiHeader';
import homeManifest from 'public/manifest.json';
import {VaultsHeader} from '@vaults/components/header/VaultsHeader';
import {AppName, APPS} from '@common/components/Apps';
import {YBribeHeader} from '@yBribe/components/header/YBribeHeader';
import {YCrvHeader} from '@yCRV/components/header/YCrvHeader';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/layouts/Header.next';
import type {TMetaFile} from '@common/components/Meta';

type TCurrentApp = {
	name: AppName | 'Home';
	manifest: TMetaFile;
	header?: ReactElement;
	menu: TMenu[];
};

function useCurrentApp({pathname}: NextRouter): TCurrentApp {
	return useMemo((): TCurrentApp => {
		if (pathname.startsWith('/vaults')) {
			const {name, manifest, menu} = APPS[AppName.VAULTS];
			return {name, manifest, menu, header: <VaultsHeader pathname={pathname} />};
		}

		if (pathname.startsWith('/ybribe')) {
			const {name, manifest, menu} = APPS[AppName.YBRIBE];
			return {name, manifest, menu, header: <YBribeHeader pathname={pathname} />};
		}

		if (pathname.startsWith('/ycrv')) {
			const {name, manifest, menu} = APPS[AppName.YCRV];
			return {name, manifest, menu, header: <YCrvHeader pathname={pathname} />};
		}

		if (pathname.startsWith('/veyfi')) {
			const {name, manifest, menu} = APPS[AppName.VEYFI];
			return {name, manifest, menu, header: <VeYfiHeader pathname={pathname} />};
		}

		return {name: 'Home', manifest: homeManifest, menu: []};
	}, [pathname]);
}

export {useCurrentApp};
