import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

function TokenIcon({
	chainID,
	size = 72,
	className,
	address
}: {
	chainID: number;
	size?: number;
	className?: string;
	address: TAddress;
}): ReactElement {
	return (
		<>
			<ImageWithFallback
				loading={'eager'}
				className={className}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${toAddress(address)}/logo-128.png`}
				alt={''}
				width={size}
				height={size}
			/>
		</>
	);
}
export default TokenIcon;
