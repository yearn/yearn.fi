import React from 'react';
import {ClaimTab} from '@veYFI/components/ClaimTab';
import {LockTab} from '@veYFI/components/LockTab';
import {ManageLockTab} from '@veYFI/components/ManageLockTab';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import Wrapper from '@veYFI/Wrapper';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {SummaryData} from '@common/components/SummaryData';
import {Tabs} from '@common/components/Tabs';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

function Index(): ReactElement {
	const {votingEscrow, positions} = useVotingEscrow();

	return (
		<>
			<h1 className={'w-full text-center text-8xl font-bold'}>
				{'veYFI'}
			</h1>
			
			<div className={'my-14 w-full'}>
				<SummaryData
					items={[
						{label: 'Total Locked YFI', content: formatAmount(formatToNormalizedValue(formatBN(votingEscrow?.supply), 18), 4)},
						{label: 'Your Locked YFI', content: formatAmount(formatToNormalizedValue(formatBN(positions?.deposit?.underlyingBalance), 18), 4)},
						{label: 'Expiration for the lock', content: positions?.unlockTime ? formatDate(positions.unlockTime, false, '-') : '-'}
					]} />
			</div>

			<Tabs
				className={'min-h-[356px]'}
				items={[
					{id: 'lock', label: 'Lock YFI', content: <LockTab />}, 
					{id: 'manage', label: 'Manage lock', content: <ManageLockTab />}, 
					{id: 'claim', label: 'Claim', content: <ClaimTab />}
				]} />
			
		</>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
