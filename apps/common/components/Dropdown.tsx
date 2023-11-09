import React, {Fragment, useState} from 'react';
import {Combobox, Transition} from '@headlessui/react';
import {useThrottledState} from '@react-hookz/web';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {performBatchedUpdates} from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {IconChevron} from '@common/icons/IconChevron';

import {ImageWithFallback} from './ImageWithFallback';

import type {ReactElement} from 'react';

const DropdownOption = (option: TDropdownOption): ReactElement => {
	const {label, description, icon} = option;
	return (
		<Combobox.Option value={option}>
			{({active}): ReactElement => (
				<div
					data-active={active}
					className={'yearn--dropdown-menu-item w-full hover:bg-neutral-0/40'}>
					{icon && (
						<div className={'h-6 w-6 rounded-full'}>
							<ImageWithFallback
								alt={label}
								width={24}
								height={24}
								src={icon}
							/>
						</div>
					)}
					<div>
						<p className={`font-normal text-neutral-900 ${icon ? 'pl-2' : 'pl-0'}`}>{label}</p>
						{description && (
							<p className={`text-xxs font-normal text-neutral-600 ${icon ? 'pl-2' : 'pl-0'}`}>
								{description}
							</p>
						)}
					</div>
				</div>
			)}
		</Combobox.Option>
	);
};

const DropdownEmpty = ({isSearching}: {isSearching: boolean}): ReactElement => {
	if (!isSearching) {
		return (
			<div className={'relative flex h-14 flex-col items-center justify-center px-4 text-center'}>
				<div className={'flex h-10 items-center justify-center'}>
					<p className={'text-sm text-neutral-900'}>{'Nothing found.'}</p>
				</div>
			</div>
		);
	}

	return (
		<div className={'relative flex h-14 flex-col items-center justify-center px-4 text-center'}>
			<div className={'flex h-10 items-center justify-center'}>
				<span className={'loader'} />
			</div>
		</div>
	);
};

export type TDropdownOption = {
	id: string;
	label: string;
	description?: string;
	icon?: string;
};

export type TDropdownProps = {
	selected?: TDropdownOption;
	options: TDropdownOption[];
	onChange?: (selected: TDropdownOption) => void;
	label?: string;
	legend?: string;
	isDisabled?: boolean;
	className?: string;
};

export const Dropdown = ({
	selected,
	options,
	onChange,
	label,
	legend,
	isDisabled,
	className
}: TDropdownProps): ReactElement => {
	const [isOpen, set_isOpen] = useThrottledState(false, 400);
	const [search, set_search] = useState('');

	const isSearching = search !== '';
	const filteredOptions = isSearching
		? options.filter(({label}): boolean => label.toLowerCase().includes(search.toLowerCase()))
		: options;

	return (
		<div className={className}>
			<div className={'relative z-20 flex flex-col space-y-1'}>
				{label && <p className={'text-base text-neutral-600'}>{label}</p>}
				<div>
					{isOpen ? (
						<div
							className={'fixed inset-0 z-0'}
							onClick={(e): void => {
								e.stopPropagation();
								e.preventDefault();
								set_isOpen(false);
							}}
						/>
					) : null}
					<Combobox
						value={selected}
						onChange={(option: TDropdownOption): void => {
							performBatchedUpdates((): void => {
								if (onChange) {
									onChange(option);
								}
								set_isOpen(false);
							});
						}}
						disabled={isDisabled}>
						<>
							<Combobox.Button
								onClick={(): void => set_isOpen((state: boolean): boolean => !state)}
								className={cl(
									'flex h-10 w-full items-center justify-between p-2 text-base md:px-3',
									isDisabled ? 'bg-neutral-300 text-neutral-600' : 'bg-neutral-0 text-neutral-900'
								)}>
								<div className={'relative flex flex-row items-center'}>
									{selected?.icon && (
										<div className={'h-6 w-6 rounded-full'}>
											<ImageWithFallback
												alt={selected.label}
												width={24}
												height={24}
												src={selected.icon}
											/>
										</div>
									)}
									<p
										className={cl(
											'max-w-[90%] overflow-x-hidden text-ellipsis whitespace-nowrap font-normal scrollbar-none md:max-w-full',
											selected?.icon ? 'pl-2' : 'pl-0',
											isDisabled ? 'text-neutral-600' : 'text-neutral-900'
										)}>
										<Combobox.Input
											className={
												'w-full cursor-default overflow-x-scroll border-none bg-transparent p-0 outline-none scrollbar-none'
											}
											displayValue={(option?: TDropdownOption): string => option?.label ?? '-'}
											spellCheck={false}
											onChange={(event): void => {
												performBatchedUpdates((): void => {
													set_isOpen(true);
													set_search(event.target.value);
												});
											}}
										/>
									</p>
								</div>
								<div className={'absolute right-2 md:right-3'}>
									<IconChevron
										aria-hidden={'true'}
										className={`h-6 w-6 transition-transform ${
											isOpen ? '-rotate-180' : 'rotate-0'
										}`}
									/>
								</div>
							</Combobox.Button>
							<Transition
								as={Fragment}
								show={isOpen}
								enter={'transition duration-100 ease-out'}
								enterFrom={'transform scale-95 opacity-0'}
								enterTo={'transform scale-100 opacity-100'}
								leave={'transition duration-75 ease-out'}
								leaveFrom={'transform scale-100 opacity-100'}
								leaveTo={'transform scale-95 opacity-0'}
								afterLeave={(): void => {
									set_isOpen(false);
									set_search('');
								}}>
								<Combobox.Options className={'yearn--dropdown-menu z-50'}>
									{filteredOptions.length === 0 ? (
										<DropdownEmpty isSearching={isSearching} />
									) : (
										filteredOptions.map(
											({id, label, description, icon}): ReactElement => (
												<DropdownOption
													key={id}
													id={id}
													label={label}
													description={description}
													icon={icon}
												/>
											)
										)
									)}
								</Combobox.Options>
							</Transition>
						</>
					</Combobox>
				</div>
				{legend && <p className={'pl-2 text-xs font-normal text-neutral-600'}>{legend}</p>}
			</div>
		</div>
	);
};
