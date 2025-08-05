import type {ReactElement, SVGProps} from 'react'

export function IconClose({...props}: SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			width={'24'}
			height={'24'}
			viewBox={'0 0 24 24'}
			fill={'none'}
			stroke={'currentColor'}
			xmlns={'http://www.w3.org/2000/svg'}
			{...props}>
			<path d={'M6 6L18 18'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
			<path d={'M6 18L18 6'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
			<path d={'M6 6L18 18'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
			<path d={'M6 18L18 6'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
		</svg>
	)
}
