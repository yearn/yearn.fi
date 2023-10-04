import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

function TokenIcon({
	chainID,
	size = 72,
	token
}: {
	chainID: number;
	size?: number;
	token: TYDaemonVault['token'];
}): ReactElement {
	return (
		<>
			<ImageWithFallback
				loading={'eager'}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${toAddress(token?.address)}/logo-128.png`}
				alt={''}
				width={size}
				height={size}
			/>
		</>
	);
}
export default TokenIcon;
