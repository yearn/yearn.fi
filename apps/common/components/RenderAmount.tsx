import {type ReactElement, useMemo} from 'react';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {amountV2} from '@yearn-finance/web-lib/utils/format';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';

import type {TAmount} from '@yearn-finance/web-lib/utils/format';

export function RenderAmount(props: TAmount): ReactElement {
	const normalizedRawValue = useMemo((): string => {
		return (amountV2({
			...props,
			options: {
				...props.options,
				minimumFractionDigits: 2,
				maximumFractionDigits: Math.max(2, Number(props.decimals)),
				shouldDisplaySymbol: true,
				shouldCompactValue: false
			}
		}));
	}, [props]);

	const shouldShowTooltip = !isZero(props.value) && props.value < 0.001;

	return (
		<span
			suppressHydrationWarning
			className={cl(shouldShowTooltip ? 'tooltip underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600' : '')}>
			{shouldShowTooltip ? (
				<span suppressHydrationWarning className={'tooltipLight bottom-full mb-1'}>
					<div className={'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'}>
						{normalizedRawValue}
					</div>
				</span>
			) : <span />}
			{amountV2(props)}
		</span>
	);
}
