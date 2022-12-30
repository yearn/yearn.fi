import React from 'react';
import meta from 'public/apps/vaults-manifest.json';
import Meta from '@common/components/Meta';

import {VotingEscrowContextApp} from './contexts/useVotingEscrow';

import type {ReactElement} from 'react';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<VotingEscrowContextApp>
				{children}
			</VotingEscrowContextApp>
		</>
	);
}