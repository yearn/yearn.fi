import Marquee from 'react-fast-marquee';
import Image from 'next/image';

import type {ReactElement} from 'react';

const PARTNERS = [
	{src: '/landing/partners/aave.png', width: 220},
	{src: '/landing/partners/ajna.png', width: 173},
	{src: '/landing/partners/compound.png', width: 246},
	{src: '/landing/partners/curve.png', width: 175},
	{src: '/landing/partners/lido.png', width: 182},
	{src: '/landing/partners/pendle.png', width: 257},
	{src: '/landing/partners/sky.png', width: 130},
	{src: '/landing/partners/spark.png', width: 194},
	{src: '/landing/partners/swell.png', width: 142}
];

export function Partners(): ReactElement {
	return (
		<div className={'flex w-full justify-center'}>
			<div className={'h-20 w-full'}>
				<Marquee
					gradient
					gradientColor={'#080A0C'}
					pauseOnHover={true}
					className={'grid h-full overflow-hidden'}>
					{PARTNERS.map(partner => (
						<div
							className={'mx-5 flex h-full max-h-[32px] flex-col items-center justify-center pr-10'}
							key={partner.src}>
							<Image
								src={partner.src}
								alt={'partner'}
								width={partner.width}
								height={32}
							/>
						</div>
					))}
				</Marquee>
			</div>
		</div>
	);
}
