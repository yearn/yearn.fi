import {formatAmount, formatPercent, toBigInt, toNormalizedValue} from '@builtbymom/web3/utils';
import {RedeemTab} from '@veYFI/components/RedeemTab';
import {RewardsTab} from '@veYFI/components/RewardsTab';
import {TabManageGauges} from '@veYFI/components/TabManageGauges';
import {TabManageVeYFI} from '@veYFI/components/TabManageVeYFI';
import {useOption} from '@veYFI/contexts/useOption';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {useVeYFIAPR} from '@veYFI/hooks/useVeYFIAPR';
import {Wrapper} from '@veYFI/Wrapper';
import {PageProgressBar} from '@common/components/PageProgressBar';
import {SummaryData} from '@common/components/SummaryData';
import {Tabs} from '@common/components/Tabs';
import {formatDateShort} from '@common/utils';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

function HeadingData(): ReactElement {
	const {votingEscrow, positions} = useVotingEscrow();
	const {dYFIPrice} = useOption();
	const APR = useVeYFIAPR({dYFIPrice});

	const totalLockedYFI = toNormalizedValue(toBigInt(votingEscrow?.supply), 18);
	const yourLockedYFI = toNormalizedValue(toBigInt(positions?.deposit?.underlyingBalance), 18);
	return (
		<SummaryData
			items={[
				{
					label: 'Max veYFI lock vAPR',
					content: APR ? formatPercent(APR * 100) : '-'
				},
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
	);
}

function Index(): ReactElement {
	const {isLoading} = useVotingEscrow();

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
				<HeadingData />
			</div>

			<Tabs items={tabs} />
		</>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
