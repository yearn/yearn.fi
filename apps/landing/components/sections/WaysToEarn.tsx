import {type ReactElement, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';

import {Button} from '../common/Button';
import {EarnCard} from '../common/EarnCard';

export function WaysToEarn(): ReactElement {
	const [isHovering, set_isHovering] = useState(false);

	return (
		<div className={'max-w-6xl'}>
			<div className={'grid grid-flow-row grid-cols-12 grid-rows-10 gap-6 md:h-[480px] md:grid-flow-col'}>
				<Link
					href={'/apps'}
					className={
						'group relative col-span-12 row-span-4 overflow-hidden rounded-lg border border-[#292929] p-6 transition-colors md:col-span-7 md:row-span-12 md:p-10'
					}
					onMouseEnter={() => set_isHovering(true)}
					onMouseLeave={() => set_isHovering(false)}
					style={{
						background: isHovering
							? '#0657F9'
							: 'linear-gradient(180deg, rgba(12, 12, 12, 0.8) 0%, rgba(26, 26, 26, 0.8) 100%)'
					}}>
					<div>
						<div className={'flex h-full flex-col justify-between'}>
							<div>
								<p className={'text-md mb-4 text-white md:text-[32px] md:group-hover:text-gray-900'}>
									{'Yield optimized, risk optimized.'}
								</p>
								<p className={'z-20 text-gray-400 md:group-hover:text-gray-900'}>
									{
										'The DeFi economy offers loads of way to earn yield on your capital. Yearn Vaults automatically take advantage of these opportunities to give you the best risk adjusted yields without you having to lift a finger.'
									}
								</p>
							</div>
							<div className={'relative h-[120px] md:h-[400px]'}>
								<Image
									className={
										'absolute -bottom-24 left-[-18px] z-10 w-[200px] md:bottom-auto md:left-[-34px] md:w-[400px]'
									}
									src={'/landing/safe-hover.png'}
									width={400}
									height={400}
									alt={'safe-hover'}
								/>
								<Image
									className={
										'absolute left-[-34px] z-10 hidden opacity-0 transition-opacity group-hover:opacity-0 md:block md:opacity-100'
									}
									src={'/landing/safe.png'}
									width={400}
									height={400}
									alt={'safe'}
								/>
							</div>
							<Button
								className={
									'absolute bottom-10 right-10 z-20 hidden hover:!bg-gray-700 group-hover:bg-gray-900 md:block'
								}>
								{'Start Earning'}
							</Button>
						</div>
					</div>
				</Link>
				<div className={'col-span-12 row-span-3 md:col-span-5 md:row-span-6'}>
					<EarnCard
						title={'Yearn Apps'}
						info={'Apps built on Yearn vaults by contributors and the wider community!'}
						logoSrc={'/landing/yearn-apps-logo.png'}
						href={'/apps/yearn-apps'}
						hoverLogoSrc={'/landing/yearn-apps-hover.png'}
					/>
				</div>
				<div className={'col-span-12 row-span-3 md:col-span-5 md:row-span-6'}>
					<EarnCard
						title={'Integrations'}
						info={
							'Yearn Vaults are a core part of DeFi, and you can access them through many popular apps and UIs.'
						}
						logoSrc={'/landing/integrations.png'}
						href={'/apps/integrations'}
						hoverLogoSrc={'/landing/integrations-hover.png'}
					/>
				</div>
			</div>
		</div>
	);
}
