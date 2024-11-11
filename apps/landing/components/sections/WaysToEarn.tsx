import {type ReactElement, useState} from 'react';
import Image from 'next/image';

import {Button} from '../common/Button';
import {EarnCard} from '../common/EarnCard';
import {IconArrow} from '../icons/IconArrow';

export function WaysToEarn(): ReactElement {
	const [isHovering, set_isHovering] = useState(false);

	return (
		<div className={'max-w-6xl pt-[160px]'}>
			<p className={'text-center text-5xl font-light text-white'}>
				{'THERE ARE LOADS OF WAYS TO EARN, WITH YEARN!'}
			</p>
			<div className={'mt-10 grid h-[480px] grid-flow-col grid-cols-12 grid-rows-4 gap-6'}>
				<div
					onMouseEnter={() => set_isHovering(true)}
					onMouseLeave={() => set_isHovering(false)}
					style={{
						background: isHovering
							? '#0657F9'
							: 'linear-gradient(180deg, rgba(12, 12, 12, 0.8) 0%, rgba(26, 26, 26, 0.8) 100%)'
					}}
					className={
						'group relative col-span-7 row-span-4 overflow-hidden rounded-lg p-10 transition-colors'
					}>
					<p className={'mb-4 text-[32px] group-hover:text-grey-900'}>
						{'VAULTS PUT YOUR CRYPTO TO WORK, SO YOU DONT HAVE TO.'}
					</p>
					<p className={'text-grey-400 group-hover:text-grey-900'}>
						{
							'The DeFi economy offers loads of way to earn yield on your capital. Yearn Vaults automatically take advantage of these opportunities to give you the best risk adjusted yields without you having to lift a finger.'
						}
					</p>
					<Image
						className={'absolute -bottom-36'}
						src={'/landing/safe-hover.png'}
						width={400}
						height={400}
						alt={'safe-hover'}
					/>
					<Image
						className={'absolute -bottom-36 transition-opacity group-hover:opacity-0'}
						src={'/landing/safe.png'}
						width={400}
						height={400}
						alt={'safe'}
					/>
					<Button
						className={'absolute bottom-10 right-10 w-[160px] hover:!bg-grey-800 group-hover:bg-grey-900'}>
						<div className={'flex items-center justify-between'}>
							<p>{'DISCOVER'}</p>
							<IconArrow className={'size-4'} />
						</div>
					</Button>
				</div>
				<div className={'col-span-5 row-span-2'}>
					<EarnCard
						title={'COMMUNITY APPS.'}
						info={'Apps built on Yearn vaults by contributors and the wider community!'}
						logoSrc={'/landing/community-logo.png'}
						hoverLogoSrc={'/landing/community-hover.png'}
					/>
				</div>
				<div className={'col-span-5 row-span-2'}>
					<EarnCard
						title={'INTEGRATIONS'}
						info={
							'Yearn Vaults are a core part of DeFi, and you can access them through many popular apps and UIs.'
						}
						logoSrc={'/landing/integrations.png'}
						hoverLogoSrc={'/landing/integrations-hover.png'}
					/>
				</div>
			</div>
		</div>
	);
}
