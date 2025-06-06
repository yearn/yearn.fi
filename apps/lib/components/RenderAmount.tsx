import {type ReactElement, useMemo} from 'react';
import {cl, formatTAmount, isZero} from '@lib/utils';

import type {TAmount} from '@lib/utils';

export function RenderAmount(props: TAmount & {shouldHideTooltip?: boolean; shouldFormatDust?: boolean}): ReactElement {
	const normalizedRawValue = useMemo((): string => {
		return formatTAmount({
			...props,
			options: {
				...props.options,
				minimumFractionDigits: 2,
				maximumFractionDigits: props?.options?.maximumFractionDigits || Math.max(2, Number(props.decimals)),
				shouldDisplaySymbol: true,
				shouldCompactValue: props.options?.shouldCompactValue || false
			}
		});
	}, [props]);

	if (props.shouldHideTooltip) {
		return <span className={'font-number'}>{formatTAmount(props)}</span>;
	}

	const shouldShowTooltip =
		props.value &&
		!isZero(props.value) &&
		((props.value < 0.001 && props.symbol !== 'percent') || (props.value < 0.0001 && props.symbol === 'percent'));

	const value = formatTAmount(props);
	return (
		<span
			title={value}
			suppressHydrationWarning
			className={cl(
				shouldShowTooltip
					? 'tooltip underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600 font-number'
					: 'font-number'
			)}>
			{shouldShowTooltip ? (
				<span
					suppressHydrationWarning
					className={'tooltipLight bottom-full mb-1'}>
					<div
						className={
							'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
						}>
						{normalizedRawValue}
					</div>
				</span>
			) : (
				<span />
			)}
			{Number(props.value) !== 0 && Number(props.value) < 0.0001 && props.shouldFormatDust
				? '< 0.0001'
				: formatTAmount(props)}
		</span>
	);
}
