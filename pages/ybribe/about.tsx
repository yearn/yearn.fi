import React, {useMemo} from 'react';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import SettingsOverwrite from '@common/components/SettingsOverwrite';
import {GaugeListEmpty} from '@yBribe/components/bribe/GaugeListEmpty';
import {RewardFeedTableHead} from '@yBribe/components/rewardFeed/RewardFeedTableHead';
import {RewardFeedTableRow} from '@yBribe/components/rewardFeed/RewardFeedTableRow';
import Wrapper from '@yBribe/Wrapper';

import type {NextRouter} from 'next/router';
import type {ReactElement, ReactNode} from 'react';
import type {SWRResponse} from 'swr';
import type {TYDaemonGaugeRewardsFeed} from '@common/types/yearn';

function	About(): ReactElement {
	const {settings: baseAPISettings} = useSettings();
	const {data: feed} = useSWR(
		`${baseAPISettings.yDaemonBaseURI}/1/bribes/newRewardFeed`,
		baseFetcher
	) as SWRResponse<TYDaemonGaugeRewardsFeed[]>;

	const	sortedFeed = useMemo((): TYDaemonGaugeRewardsFeed[] => {
		return (feed || []).sort((a, b): number => {
			return Number(b.timestamp) - Number(a.timestamp);
		});
	}, [feed]);

	return (
		<section className={'mt-4 grid w-full grid-cols-1 gap-10 pb-10 md:mt-20 md:grid-cols-2'}>
			<div>
				<div className={'mb-10 w-full bg-neutral-100 p-10'}>
					<div aria-label={'Better Bribes'} className={'flex flex-col pb-6'}>
						<h2 className={'text-3xl font-bold'}>{'Better Bribes'}</h2>
					</div>
					<div aria-label={'Better Bribes details'}>
						<p className={'pb-4 text-neutral-600'}>{'yBribes pairs users looking to buy votes, with those looking to sell them. '}</p>
						<p className={'pb-4 text-neutral-600'}>{'You can sell your vote to the highest bidder by voting on briber\'s gauge and claiming rewards in exchange for your voting power.'}</p>
						<p className={'text-neutral-600'}>{'For those looking to buy votes, you can offer bribes to a gauge using the \'Bribe a Gauge\' function. Resulting in a boost to CRV emissions to the gauge of your choosing.'}</p>
					</div>
				</div> 

				<div className={'mb-10 w-full bg-neutral-100 p-10'}>
					<div aria-label={'Claim Period'} className={'flex flex-col pb-6'}>
						<h2 className={'text-3xl font-bold'}>{'Claim Period'}</h2>
					</div>
					<div aria-label={'Claim Period details'}>
						<p className={'pb-4 text-neutral-600'}>{'Claim periods run from thursday to thursday, and the scrolling clock on the main page displays the time remaining in the current period.'}</p>
						<p className={'pb-4 text-neutral-600'}>{'Make sure you claim any claimable rewards before the current period ends, and/ or submit your votes for the next period. '}</p>
						<p className={'text-neutral-600'}>{'Be sure to claim any rewards before voting again on the same gauge or you\'ll be locked out of rewards until the following week.'}</p>
					</div>
				</div>


				<div className={'mb-10 w-full bg-neutral-100 p-10'}>
					<div aria-label={'Why Bribe?'} className={'flex flex-col pb-6'}>
						<h2 className={'text-3xl font-bold'}>{'Why Bribe?'}</h2>
					</div>
					<div aria-label={'Why Bribe? details'}>
						<p className={'pb-4 text-neutral-600'}>{'Curve conducts a weekly governance vote that determines the allocation of CRV rewards to various pools. By buying votes, DAOs, protocols and users can influence the direction of these rewards and boost yields in pools beneficial to them. '}</p>
						<p className={'text-neutral-600'}>{'Holders who are not interested in directing rewards can instead sell their voting power to users who do. Win win.'}</p>
					</div>
				</div>
				<SettingsOverwrite />
			</div>

			<div>
				<div className={'w-full bg-neutral-100'}>
					<div className={'p-10'}>
						<h2 className={'text-3xl font-bold'}>{'Feed'}</h2>
					</div>
					<div className={'grid w-full grid-cols-1 pb-2 md:pb-4'}>
						<RewardFeedTableHead />
						{(feed || []).length === 0 ? (
							<GaugeListEmpty />
						) : sortedFeed.map((item): ReactNode => {
							if (!item) {
								return (null);
							}
							return <RewardFeedTableRow
								key={`${item.txHash}_${item.briber}_${item.rewardToken}`}
								currentRewardAdded={item} />;
						})}
					</div>
				</div>
			</div>
		</section>
	);
}

About.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default About;
