import {useState} from 'react';
import Renderable from '@yearn-finance/web-lib/components/Renderable';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

function TokenIcon({
	chainID,
	size = 72,
	token
}: {
	chainID: number,
	size?: number,
	token: TYDaemonVault['token']
}): ReactElement {
	const [imageType, set_imageType] = useState<'Vault' | 'Underlying' | 'Fallback'>('Vault');

	function renderMultipleAssetImage(): ReactElement {
		if (token?.underlyingTokensAddresses?.length === 2) {
			return (
				<div className={'flex flex-row items-center justify-center'}>
					<ImageWithFallback
						loading={'eager'}
						src={`${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${toAddress(token.underlyingTokensAddresses[0])}/logo-128.png`}
						style={{marginRight: size * 0.8 / -4}}
						alt={''}
						width={(size * 0.8)}
						height={(size * 0.8)} />
					<ImageWithFallback
						loading={'eager'}
						src={`${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${toAddress(token.underlyingTokensAddresses[1])}/logo-128.png`}
						alt={''}
						style={{marginLeft: size * 0.8 / -4}}
						width={(size * 0.8)}
						height={(size * 0.8)} />
				</div>
			);
		}
		return (
			<ImageWithFallback
				loading={'eager'}
				src={'/placeholder.png'}
				alt={''}
				width={size}
				height={size} />
		);
	}

	return (
		<>
			<Renderable shouldRender={imageType === 'Vault'}>
				<ImageWithFallback
					loading={'eager'}
					src={`${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${toAddress(token?.address)}/logo-128.png`}
					onCatchError={(): void => set_imageType('Fallback')}
					alt={''}
					width={size}
					height={size} />
			</Renderable>
			<Renderable shouldRender={imageType === 'Fallback'}>
				<ImageWithFallback
					loading={'eager'}
					src={'/placeholder.png'}
					alt={''}
					width={size}
					height={size} />
			</Renderable>
			<Renderable shouldRender={imageType === 'Underlying'}>
				{renderMultipleAssetImage()}
			</Renderable>
		</>

	);
}
export default TokenIcon;
