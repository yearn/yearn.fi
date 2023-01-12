
import type {ReactElement} from 'react';

type TItem = {
	label: string,
	content: string
}

type TTabsProps = {
	items: TItem[],
}

function SummaryData({items}: TTabsProps): ReactElement {
	return (
		<div className={'align-center flex w-full flex-row flex-wrap justify-center gap-14'}>
			{items.map((({label, content}): ReactElement => (
				<div key={label} className={'flex flex-col items-center justify-center space-y-2'}>
					<b className={'font-number text-3xl'} suppressHydrationWarning>
						{content}
					</b>
					<p className={'text-center text-xs text-neutral-600'}>
						{label}
					</p>
				</div>
			)))}
		</div>
	);
}

export {SummaryData};
