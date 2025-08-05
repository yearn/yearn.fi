import {cl} from '@lib/utils'

import type {ReactElement} from 'react'

export function AnimatedGradientBackgroundForV3(): ReactElement {
	return (
		<div
			style={{background: 'linear-gradient(0deg, #D21162 24.91%, #2C3DA6 99.66%)'}}
			className={cl('absolute inset-0', 'pointer-events-none')}
		/>
	)
}
