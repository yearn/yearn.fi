import {Fragment} from 'react';
import {cl} from '@builtbymom/web3/utils';

import type {FC} from 'react';

type TAPYSublineProps = {
	hasPendleArbRewards: boolean;
	hasKelpNEngenlayer: boolean;
	hasKelp: boolean;
};

export const APYSubline: FC<TAPYSublineProps> = ({hasPendleArbRewards, hasKelpNEngenlayer, hasKelp}) => {
	if (hasKelpNEngenlayer) {
		return (
			<small className={cl('whitespace-nowrap text-xs text-neutral-400 self-end -mb-4 absolute top-6')}>
				{`+1x Kelp Miles`}
				<br />
				{'+1x EigenLayer Points'}
			</small>
		);
	}
	if (hasKelp) {
		return (
			<small className={cl('whitespace-nowrap text-xs text-neutral-400 self-end -mb-4 absolute top-6')}>
				{`+ 1x Kelp Miles`}
			</small>
		);
	}
	if (hasPendleArbRewards) {
		return (
			<small className={cl('whitespace-nowrap text-xs text-neutral-400 self-end -mb-4 absolute top-6')}>
				{`+ 2500 ARB/week`}
			</small>
		);
	}
	return <Fragment />;
};
