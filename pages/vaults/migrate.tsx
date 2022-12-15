import React, {Fragment, useMemo} from 'react';
import VaultListExternalMigration from '@vaults/components/list/VaultListExternalMigration';
import Wrapper from '@vaults/Wrapper';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import ValueAnimation from '@common/components/ValueAnimation';

import type {ReactElement} from 'react';

function	HeaderUserPosition(): ReactElement {
	const	formatedYouHave = useMemo((): string => formatAmount(35.32 || 0), []);
	const	formatedYouEarned = useMemo((): string => formatAmount(0.02), []);

	return (
		<Fragment>
			<div className={'col-span-12 w-full md:col-span-8'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'You could get'}</p>
				<b className={'font-number text-4xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youHave'}
						value={formatedYouHave}
						defaultValue={formatAmount(0)}
						suffix={'%'} />
				</b>
			</div>
			<div className={'col-span-12 w-full md:col-span-4'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'You are getting'}</p>
				<b className={'font-number text-3xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youEarned'}
						value={formatedYouEarned ? formatedYouEarned : ''}
						defaultValue={formatAmount(0)}
						suffix={'%'} />
				</b>
			</div>
		</Fragment>
	);
}

function	Index(): ReactElement {
	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>

			<HeaderUserPosition />

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
