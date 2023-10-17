import {Renderable} from '@yearn-finance/web-lib/components/Renderable';

import type {ReactElement} from 'react';
import type {TNormalizedBN} from '@common/types/types';

type TAmountInputProps = {
	amount: TNormalizedBN;
	maxAmount?: TNormalizedBN;
	maxLabel?: string;
	label?: string;
	placeholder?: string;
	legend?: string | ReactElement;
	error?: string;
	disabled?: boolean;
	loading?: boolean;
	onAmountChange?: (amount: string) => void;
	onLegendClick?: () => void;
	onMaxClick?: () => void;
};

export function AmountInput({
	amount,
	maxAmount,
	label,
	placeholder,
	legend,
	error,
	disabled,
	loading,
	onAmountChange,
	onLegendClick,
	onMaxClick
}: TAmountInputProps): ReactElement {
	return (
		<div className={'w-full'}>
			{label && <p className={'mb-1 w-full truncate text-base text-neutral-600'}>{label}</p>}
			<div className={'relative flex w-full items-center justify-center'}>
				<input
					className={`h-10 w-full p-2 font-mono text-base font-normal outline-none ${
						maxAmount && !disabled ? 'pr-12' : null
					} ${
						error ? 'border border-solid border-[#EA5204] focus:border-[#EA5204]' : 'border-0 border-none'
					} ${disabled ? 'bg-neutral-300 text-neutral-600' : 'bg-neutral-0'}`}
					type={'text'}
					autoComplete={'off'}
					aria-label={label}
					value={amount.normalized}
					onChange={onAmountChange ? (e): void => onAmountChange(e.target.value) : undefined}
					placeholder={loading ? '' : placeholder ?? '0'}
					disabled={disabled}
				/>
				<Renderable shouldRender={!!maxAmount && !disabled}>
					<button
						onClick={onMaxClick ? (): void => onMaxClick() : undefined}
						className={
							'absolute right-2 ml-2 h-6 cursor-pointer border-none bg-neutral-900 px-2 py-1 text-xs text-neutral-0 transition-colors hover:bg-neutral-700'
						}>
						{'Max'}
					</button>
				</Renderable>
			</div>
			<Renderable shouldRender={!!error || !!legend}>
				<legend
					role={onLegendClick ? 'button' : 'text'}
					onClick={onLegendClick}
					suppressHydrationWarning
					className={`mt-1 pl-1 text-xs md:mr-0 ${error ? 'text-[#EA5204]' : 'text-neutral-600'}`}>
					{error ?? legend}
				</legend>
			</Renderable>
		</div>
	);
}
