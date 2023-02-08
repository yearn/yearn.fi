import React from 'react';
import VaultListExternalMigration from '@vaults/components/list/VaultListExternalMigration.unused';
import Wrapper from '@vaults/Wrapper';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

function	Migrate(): ReactElement {
	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>

			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<VaultListExternalMigration />
			</div>

		</section>
	);
}

Migrate.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Migrate;
