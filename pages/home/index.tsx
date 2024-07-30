import {type ReactElement} from 'react';

export default function Home(): ReactElement {
	return (
		<div className={'my-20 flex w-full justify-center'}>
			<div className={'w-full max-w-6xl'}>
				<div
					className={
						'flex w-full  justify-start text-[100px] font-bold uppercase leading-[108px] text-white'
					}>
					{'Stake '}
					<br /> {'with yearn'}
				</div>
			</div>
		</div>
	);
}
