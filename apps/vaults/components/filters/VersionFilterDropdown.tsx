import {useMemo} from 'react';
import {MultiSelectDropdown} from '@lib/components/MultiSelectDropdown';

import type {TMultiSelectOptionProps} from '@lib/components/MultiSelectDropdown';

export const VersionFilterDropdown: React.FC<{
	selectedVersion: string;
	onVersionChange: (version: string) => void;
	className?: string;
}> = ({selectedVersion, onVersionChange, className = ''}) => {
	const versionOptions: TMultiSelectOptionProps[] = useMemo(
		() => [
			{
				label: 'All Versions',
				value: 'All Versions',
				isSelected: selectedVersion === 'All Versions'
			},
			{
				label: 'V2',
				value: 'V2',
				isSelected: selectedVersion === 'V2'
			},
			{
				label: 'V3',
				value: 'V3',
				isSelected: selectedVersion === 'V3'
			}
		],
		[selectedVersion]
	);

	const handleSelect = (options: TMultiSelectOptionProps[]): void => {
		const selectedOption = options.find(option => option.isSelected);
		if (selectedOption) {
			onVersionChange(selectedOption.label);
		}
	};

	return (
		<div className={className}>
			<MultiSelectDropdown
				options={versionOptions}
				onSelect={handleSelect}
				buttonClassName={'mb-0 h-full rounded-full bg-white/10 px-3 py-2 text-[14px] text-neutral-900'}
				comboboxOptionsClassName={'rounded-lg border border-white/20 bg-black p-2 shadow-xl'}
				customDefaultLabel={selectedVersion}
			/>
		</div>
	);
};
