import {Button} from '../common/Button';

import type {ReactElement} from 'react';

//todo: ask design to remove border
export function Hero(): ReactElement {
	return (
		<div className={'flex w-full justify-center'}>
			<div
				style={{
					backgroundImage: "url('/landing/hero.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: 'auto 100%',
					backgroundPosition: 'center'
				}}
				className={
					'relative mx-6 mt-6 flex h-[568px] w-full max-w-[2352px] flex-col items-center self-center rounded-lg border border-[#292929]'
				}>
				<div className={'mt-[88px] text-center'}>
					<p className={'text-[80px] font-bold leading-[80px] text-white'}>{'THE DEFI WAY'}</p>
					<p className={'text-[80px] font-bold leading-[80px] text-white'}>{'TO EARN CRYPTO'}</p>
					<p className={'mt-4 text-grey-400'}>
						{'Yearn is DeFi’s longest running, most battle tested, and most trusted yield protocol.'}
					</p>
				</div>
				<div className={'mt-[72px] flex gap-2'}>
					<Button className={'w-[192px] px-[15px]'}>{'DISCOVER PRODUCTS'}</Button>
					<Button
						variant={'secondary'}
						className={'w-[192px]'}>
						{'SUBMIT YOUR APP'}
					</Button>
				</div>
			</div>
		</div>
	);
}
