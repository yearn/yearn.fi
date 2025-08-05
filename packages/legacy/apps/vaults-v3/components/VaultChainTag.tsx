import {opacityToHex} from '@lib/utils/opacity'

import type {FC} from 'react'

const ChainColors: {[key: number]: string} = {
	1: '#627EEA',
	10: '#C80016',
	137: '#A726C1',
	250: '#1969FF',
	8453: '#1C55F5',
	42161: '#2F3749',
	747474: '#f6ff0d'
}

const ChainTextColors: {[key: number]: string} = {
	747474: '#000000'
}

const ChainNames: {[key: number]: string} = {
	1: 'Ethereum',
	10: 'Optimism',
	137: 'Polygon PoS',
	250: 'Fantom',
	8453: 'Base',
	42161: 'Arbitrum',
	747474: 'Katana'
}

export const VaultChainTag: FC<{
	chainID?: number
	backgroundOpacity?: number
}> = ({chainID = 1, backgroundOpacity = 1}) => {
	const textOpacity = backgroundOpacity > 0.5 ? 1 : 0.8
	return (
		<div
			className={'rounded-2xl px-2 py-0.5 text-xs text-neutral-900'}
			style={{
				backgroundColor: `${ChainColors[chainID]}${opacityToHex(backgroundOpacity)}`,
				color: `${ChainTextColors[chainID] || '#ffffff'}${opacityToHex(textOpacity)}`
			}}>
			{ChainNames[chainID]}
		</div>
	)
}
