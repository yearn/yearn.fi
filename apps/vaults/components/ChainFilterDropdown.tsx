import React, {useEffect, useRef, useState} from 'react';
import {useChainOptions} from '@common/hooks/useChains';
import {IconChevron} from '@common/icons/IconChevron';

import type {TMultiSelectOptionProps} from '@common/components/MultiSelectDropdown';

type TChainFilterDropdownProps = {
	chains: number[];
	onChangeChains: (chains: number[] | null) => void;
	className?: string;
};

const getChainDisplayText = (chains: number[], chainOptions: TMultiSelectOptionProps[]): string => {
	if (chains.length === 0) return 'No chains';
	if (chains.length === chainOptions.length) return 'All chains';
	if (chains.length === 1) {
		const chain = chainOptions.find(option => Number(option.value) === chains[0]);
		return chain?.label || 'Chain';
	}
	return `${chains.length} chains`;
};

const SelectAllOption: React.FC<{
	isSelected: boolean;
	onToggle: () => void;
}> = ({isSelected, onToggle}) => (
	<div className={'mb-2 border-b border-white/20 pb-2'}>
		<label className={'flex cursor-pointer items-center rounded p-2 transition-colors hover:bg-white/10'}>
			<input
				type={'checkbox'}
				checked={isSelected}
				onChange={onToggle}
				className={'mr-2 accent-blue-500'}
			/>
			<span className={'text-sm font-medium text-white'}>{'All chains'}</span>
		</label>
	</div>
);

const ChainOption: React.FC<{
	option: TMultiSelectOptionProps;
	isSelected: boolean;
	onToggle: () => void;
}> = ({option, isSelected, onToggle}) => (
	<label className={'flex cursor-pointer items-center rounded p-2 transition-colors hover:bg-white/10'}>
		<input
			type={'checkbox'}
			checked={isSelected}
			onChange={onToggle}
			className={'mr-2 accent-blue-500'}
		/>
		<div className={'flex items-center'}>
			{option.icon && (
				<div className={'mr-2 size-6 shrink-0'}>{React.cloneElement(option.icon, {width: 24, height: 24})}</div>
			)}
			<span className={'text-sm text-white'}>{option.label}</span>
		</div>
	</label>
);

export const ChainFilterDropdown: React.FC<TChainFilterDropdownProps> = ({chains, onChangeChains, className = ''}) => {
	const [isDropdownOpen, set_isDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const chainOptions = useChainOptions(chains);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent): void => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				set_isDropdownOpen(false);
			}
		};

		if (isDropdownOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isDropdownOpen]);

	const handleChainToggle = (chainId: number): void => {
		const newChains = chains.includes(chainId) ? chains.filter(id => id !== chainId) : [...chains, chainId];
		onChangeChains(newChains.length === 0 ? null : newChains);
	};

	const handleSelectAll = (): void => {
		const allChainIds = chainOptions.map(option => Number(option.value));
		onChangeChains(chains.length === chainOptions.length ? null : allChainIds);
	};

	return (
		<div
			className={`relative ${className}`}
			ref={dropdownRef}>
			<button
				onClick={() => set_isDropdownOpen(!isDropdownOpen)}
				className={
					'mb-0 flex h-full items-center justify-center gap-1 rounded-full bg-white/10 px-3 py-2 text-[14px] text-white'
				}>
				{getChainDisplayText(chains, chainOptions)}
				<IconChevron className={`size-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
			</button>
			{isDropdownOpen && (
				<div className={'absolute top-full z-50 mt-1 w-54'}>
					<div
						className={'max-h-48 overflow-y-auto rounded-lg border border-white/20 bg-black p-2 shadow-xl'}>
						<SelectAllOption
							isSelected={chains.length === chainOptions.length}
							onToggle={handleSelectAll}
						/>
						{chainOptions.map(option => (
							<ChainOption
								key={option.value}
								option={option}
								isSelected={chains.includes(Number(option.value))}
								onToggle={() => handleChainToggle(Number(option.value))}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
};
