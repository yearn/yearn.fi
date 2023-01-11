import React, {cloneElement, Fragment, useState} from 'react';
import {Combobox, Transition} from '@headlessui/react';
import IconChevron from '@common/icons/IconChevron';
import {formatPercent} from '@common/utils';

import type {ReactElement} from 'react';
import type {TDropdownGaugeItemProps, TDropdownGaugeOption, TDropdownGaugeProps} from '@common/types/types';

function DropdownItem({option}: TDropdownGaugeItemProps): ReactElement {
	return (
		<Combobox.Option value={option}>
			{({active}): ReactElement => (
				<div data-active={active} className={'yearn--dropdown-menu-item w-full hover:bg-neutral-0/40'}>
					<div className={'h-6 w-6 rounded-full'}>
						{option?.icon ? cloneElement(option.icon) : null}
					</div>
					<div>
						<p className={`${option.icon ? 'pl-2' : 'pl-0'} font-normal text-neutral-900`}>
							{option.label}
						</p>
						<p className={`${option.icon ? 'pl-2' : 'pl-0'} text-xxs font-normal text-neutral-600`}>
							{`APY ${formatPercent((option?.value?.APY || 0) * 100)}`}
						</p>
					</div>
				</div>
			)}
		</Combobox.Option>
	);
}

function DropdownEmpty({query}: {query: string}): ReactElement {
	if (query !== '') {
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
}

function Dropdown({
	options,
	selected,
	onSelect,
	placeholder = ''
}: TDropdownGaugeProps): ReactElement {
	const [isOpen, set_isOpen] = useState(false);
	const [query, set_query] = useState('');

	const filteredOptions = query === ''
		? options
		: options.filter((option): boolean => {
			return (option.label).toLowerCase().includes(query.toLowerCase());
		});

	return (
		<div>
			{isOpen ? (
				<div
					className={'fixed inset-0 z-0'}
					onClick={(e): void => {
						e.stopPropagation();
						e.preventDefault();
						set_isOpen(false);
					}} />
			) : null}
			<Combobox
				value={selected}
				onChange={onSelect}>
				<>
					<Combobox.Button
						onClick={(): void => set_isOpen(!isOpen)}
						className={'flex h-10 w-full items-center justify-between bg-neutral-0 p-2 text-base text-neutral-900 md:px-3'}>
						<div className={'relative flex flex-row items-center'}>
							<div key={selected?.label} className={'h-6 w-6 rounded-full'}>
								{selected?.icon ? cloneElement(selected.icon) : <div className={'h-6 w-6 rounded-full bg-neutral-500'} />}
							</div>
							<p className={'max-w-[90%] overflow-x-hidden text-ellipsis whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none md:max-w-full'}>
								<Combobox.Input
									className={'w-full cursor-default overflow-x-scroll border-none bg-transparent p-0 outline-none scrollbar-none'}
									displayValue={(option: TDropdownGaugeOption): string => option.label}
									placeholder={placeholder}
									spellCheck={false}
									onChange={(event): void => set_query(event.target.value)} />
							</p>
						</div>
						<div className={'absolute right-2 md:right-3'}>
							<IconChevron
								aria-hidden={'true'}
								className={`h-6 w-6 transition-transform ${isOpen ? '-rotate-180' : 'rotate-0'}`} />
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
						afterLeave={(): void => set_query('')}>
						<Combobox.Options static className={'yearn--dropdown-menu z-50'}>
							{filteredOptions.length === 0 ? (
								<DropdownEmpty query={query} />
							) : (
								filteredOptions
									.map((option): ReactElement => (
										<DropdownItem
											key={option.label}
											option={option} />
									)
									))}
						</Combobox.Options>
					</Transition>
				</>
			</Combobox>
		</div>
	);
}

export {Dropdown};
