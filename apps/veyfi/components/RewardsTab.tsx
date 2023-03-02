import {Button} from '@yearn-finance/web-lib/components/Button';
import {AmountInput} from '@common/components/AmountInput';
import {Dropdown} from '@common/components/Dropdown';

import type {ReactElement} from 'react';

function RewardsTab(): ReactElement {
	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<div className={'flex flex-col gap-4'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Claim Rewards'}
					</h2>
				</div>

				<div className={'grid grid-cols-1 gap-4 md:grid-cols-4'}>
					<AmountInput
						label={'Total unclaimed rewards (oYFI)'}
						amount={0}
						legend={'≈ $ 420.00'}
						disabled
					/>
					<Button 
						className={'w-full md:mt-7'}
						onClick={(): void => undefined}
						isBusy={false}
						disabled={false}
					>
						{'Claim All'}
					</Button>
				</div>
			</div>

			<div className={'flex flex-col gap-4'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Claim Separately'}
					</h2>
				</div>

				<div className={'grid grid-cols-1 gap-4 md:grid-cols-4'}>
					<Dropdown 
						label={'Gauge'}
						options={[]}
					/>
					<AmountInput
						label={'Unclaimed rewards (oYFI)'}
						amount={0}
						legend={'≈ $ 420.00'}
						disabled
					/>
					<Button 
						className={'w-full md:mt-7'}
						onClick={(): void => undefined}
						isBusy={false}
						disabled={false}
					>
						{'Claim'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {RewardsTab};
