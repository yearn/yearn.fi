import type {FC} from 'react';

export const VaultEmptyCard: FC = () => {
	return (
		<div className={'flex flex-1 flex-col justify-center rounded-lg border border-black/30 bg-black/20 p-6 '}>
			<p className={'text-[18px] font-medium text-white/75'}>{'No positions found'}</p>
			<p className={'text-[14px] font-medium text-white/50'}>{'Your vault positions will show here'}</p>
		</div>
	);
};
