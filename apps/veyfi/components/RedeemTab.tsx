import {Button} from '@yearn-finance/web-lib/components/Button';
import {AmountInput} from '@common/components/AmountInput';

import type {ReactElement} from 'react';

function RedeemTab(): ReactElement {
	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<div className={'flex flex-col gap-4'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Redeem'}
					</h2>
				</div>

				<div className={'grid grid-cols-1 gap-4 md:grid-cols-4'}>
					<AmountInput
						label={'You have oYFI'}
						amount={0}
						legend={'≈ $ 420.00'}
						disabled
					/>
					<AmountInput
						label={'YFI you want to redeem'}
						amount={0}
						maxAmount={100}
						legend={'≈ $ 420.00'}
					/>
					<AmountInput
						label={'ETH fee'}
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
						{'Redeem'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {RedeemTab};
