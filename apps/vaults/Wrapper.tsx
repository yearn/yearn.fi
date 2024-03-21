import {type NextRouter} from 'next/router';
import Meta from '@common/components/Meta';
import {useCurrentApp} from '@common/hooks/useCurrentApp';

import type {ReactElement} from 'react';

export function Wrapper({children, router}: {children: ReactElement; router: NextRouter}): ReactElement {
	const {manifest} = useCurrentApp(router);

	return (
		<div className={'mx-auto my-0 max-w-6xl pt-4 md:mb-0 md:mt-16'}>
			<Meta meta={manifest} />
			{children}
		</div>
	);
}
