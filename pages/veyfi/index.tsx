import {RedeemTab} from '@veYFI/components/RedeemTab';
import {RewardsTab} from '@veYFI/components/RewardsTab';
import {TabManageGauges} from '@veYFI/components/TabManageGauges';
import {TabManageVeYFI} from '@veYFI/components/TabManageVeYFI';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {Wrapper} from '@veYFI/Wrapper';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {PageProgressBar} from '@common/components/PageProgressBar';
import {SummaryData} from '@common/components/SummaryData';
import {Tabs} from '@common/components/Tabs';
import {formatDateShort} from '@common/utils';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

function Index(): ReactElement {
	const {votingEscrow, positions, isLoading} = useVotingEscrow();

	const totalLockedYFI = formatToNormalizedValue(toBigInt(votingEscrow?.supply), 18);
	const yourLockedYFI = formatToNormalizedValue(toBigInt(positions?.deposit?.underlyingBalance), 18);

	const tabs = [
		{id: 'gauges', label: 'Manage Gauges', content: <TabManageGauges />},
		{id: 'manage', label: 'Manage veYFI', content: <TabManageVeYFI />},
		{id: 'rewards', label: 'Claim Rewards', content: <RewardsTab />},
		{id: 'redeem', label: 'Redeem dYFI', content: <RedeemTab />}
	].filter(Boolean);

	return (
		<>
			<PageProgressBar isLoading={isLoading} />

			<h1 className={'w-full text-center text-8xl font-bold'}>{'veYFI'}</h1>

			<div className={'my-14 w-full'}>
				<SummaryData
					items={[
						{
							label: 'Total Locked YFI',
							content: formatAmount(totalLockedYFI, 4) ?? '-'
						},
						{
							label: 'Your Locked YFI',
							content: formatAmount(yourLockedYFI, 4) ?? '-'
						},
						{
							label: 'Expiration for the lock',
							content: positions?.unlockTime ? formatDateShort(positions.unlockTime) : '-'
						}
					]}
				/>
			</div>

			<Tabs items={tabs} />
		</>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
