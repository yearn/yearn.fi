import Link from 'next/link';
import {Button} from '@yearn-finance/web-lib/components/Button';

import type {ReactElement} from 'react';

export function VoteGauge(): ReactElement {
	return (
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-2 grid w-full'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Vote for Gauge'}
					</h2>
					<div className={'text-neutral-600'} >
						<p>{'Vote to direct future YFI rewards to a particular gauge.'}</p>
					</div>
					<div>
						<Link
							href={'https://snapshot.org/#/veyfi.eth'}
							className={'block w-full md:w-64'}
							target={'_blank'}>
							<Button className={'w-full md:w-64'}>
								{'Vote on Snapshot'}
							</Button>
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
