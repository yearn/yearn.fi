import {IconExpand} from '@lib/icons/IconExpand';
import {IconMinimize} from '@lib/icons/IconMinimize';
import {formatAmount} from '@lib/utils';

import type {FC} from 'react';

export const VaultBalanceCard: FC<{
	balance: number;
	showExpandButton?: boolean;
	isExpanded: boolean;
	onExpansionClick?: () => void;
}> = ({balance, showExpandButton, isExpanded, onExpansionClick}) => {
	return (
		<div className={'flex h-[120px] flex-col justify-center p-6'}>
			<div className={'flex items-center gap-2'}>
				<p className={'text-[12px] font-medium text-neutral-900/75'}>{'Your Deposits'}</p>
				{showExpandButton && (
					<div
						className={
							'flex size-5 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20'
						}
						onClick={onExpansionClick}
					>
						{!isExpanded ? <IconExpand /> : <IconMinimize />}
					</div>
				)}
			</div>
			<p className={'text-[28px] font-medium text-neutral-900'}>
				<span className={'font-medium text-neutral-900/50'}>{'$'}</span>
				{formatAmount(balance)}
			</p>
		</div>
	);
};
