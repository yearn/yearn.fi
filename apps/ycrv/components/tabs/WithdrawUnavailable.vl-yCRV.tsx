import React from 'react';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useTimer} from '@common/hooks/useTimer';
import {useVLyCRV} from '@yCRV/hooks/useVLyCRV';

import type {ReactElement} from 'react';

function WithdrawUnavailable(): ReactElement {
	const {isActive} = useWeb3();
	const {initialData: {userInfo}} = useVLyCRV();
	const time = useTimer({endTime: userInfo.unlockTime});

	return (
		<div
			aria-label={'yCRV Withdraw Not Available'}
			className={'col-span-12 mb-4'}>
			{isActive ? (
				<div>
					<h1>{userInfo.unlockTime ? `You can withdraw in ${time}` : 'You have nothing to withdraw'}</h1>
					<p className={'mt-4'}>{'Please note, you can’t withdraw until the end of the following voting period. See \'how it works\' for more info.'}</p>
				</div>
			): (
				<div>
					<p>{'Connect your wallet to withdraw'}</p>
				</div>
			)}
		</div>
	);
}

export default WithdrawUnavailable;
