import React from 'react';
import VaultListExternalMigration from '@vaults/components/list/VaultListExternalMigration';
import Wrapper from '@vaults/Wrapper';

import type {ReactElement} from 'react';

function	Index(): ReactElement {
	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>

			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<VaultListExternalMigration />
			</div>

		</section>
	);
}

Index.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default Index;
