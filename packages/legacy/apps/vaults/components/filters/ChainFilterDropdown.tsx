import {MultiSelectDropdown} from '@lib/components/MultiSelectDropdown'
import {useChainOptions} from '@lib/hooks/useChains'
import type React from 'react'

type TChainFilterDropdownProps = {
	chains: number[] | null
	onChangeChains: (chains: number[] | null) => void
	className?: string
}

export const ChainFilterDropdown: React.FC<TChainFilterDropdownProps> = ({chains, onChangeChains, className = ''}) => {
	const chainOptions = useChainOptions(chains)

	const optionsWithSelection = chainOptions.map(option => ({
		...option,
		isSelected: (chains || []).includes(Number(option.value))
	}))

	const selectedOptions = optionsWithSelection.filter(option => option.isSelected)

	const ChainLogosStack: React.FC = () => (
		<div className={'flex items-center'}>
			<div
				className={
					'mb-0 flex h-full cursor-pointer items-center justify-center gap-1 rounded-full bg-neutral-100 p-2 text-[16px] text-neutral-900'
				}>
				{selectedOptions.length > 0 ? (
					selectedOptions.map((option, index) => (
						<div
							key={option.value}
							className={'relative flex size-6 items-center justify-center'}
							style={{
								marginLeft: index > 0 ? '-4px' : '0',
								zIndex: selectedOptions.length - index
							}}>
							{option.icon}
						</div>
					))
				) : (
					<span className={'px-1 text-neutral-600'}>{'Select chains'}</span>
				)}
			</div>
		</div>
	)

	return (
		<div className={className}>
			<MultiSelectDropdown
				customRender={<ChainLogosStack />}
				options={optionsWithSelection}
				onSelect={(options): void => {
					const selectedChains = options
						.filter((o): boolean => o.isSelected)
						.map((option): number => Number(option.value))
					onChangeChains(selectedChains.length === 0 ? null : selectedChains)
				}}
			/>
		</div>
	)
}
