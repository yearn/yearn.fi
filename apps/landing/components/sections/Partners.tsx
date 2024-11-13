import Marquee from 'react-fast-marquee';
import Image from 'next/image';

import type {ReactElement} from 'react';

export function Partners(): ReactElement {
	return (
		<div className={'flex w-full justify-center'}>
			<div className={'h-20 w-full'}>
				<Marquee
					gradient
					gradientColor={'black'}
					pauseOnHover={true}
					className={'grid h-full overflow-hidden'}>
					<div className={'mx-5 flex h-full flex-col items-center justify-center pr-10 '}>
						<Image
							src={'/landing/partners/ajna.png'}
							alt={'Ajna'}
							width={174}
							height={32}
						/>
					</div>{' '}
					<div className={'mx-5 flex flex-col items-center justify-center pr-10 '}>
						<Image
							src={'/landing/partners/ajna.png'}
							alt={'Ajna'}
							width={174}
							height={32}
						/>
					</div>
					<div className={'mx-5 flex flex-col items-center justify-center pr-10 '}>
						<Image
							src={'/landing/partners/ajna.png'}
							alt={'Ajna'}
							width={174}
							height={32}
						/>
					</div>
					<div className={'mx-5 flex flex-col items-center justify-center pr-10 '}>
						<Image
							src={'/landing/partners/ajna.png'}
							alt={'Ajna'}
							width={174}
							height={32}
						/>
					</div>
					<div className={'mx-5 flex flex-col items-center justify-center pr-10 '}>
						<Image
							src={'/landing/partners/ajna.png'}
							alt={'Ajna'}
							width={174}
							height={32}
						/>
					</div>
					<div className={'mx-5 flex flex-col items-center justify-center pr-10 '}>
						<Image
							src={'/landing/partners/ajna.png'}
							alt={'Ajna'}
							width={174}
							height={32}
						/>
					</div>
				</Marquee>
			</div>
		</div>
	);
}
