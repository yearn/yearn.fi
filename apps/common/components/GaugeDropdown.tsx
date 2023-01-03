import React, {cloneElement, Fragment, useState} from 'react';
import {Listbox, Transition} from '@headlessui/react';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {useBalance} from '@common/hooks/useBalance';
import IconChevron from '@common/icons/IconChevron';

import type {ReactElement} from 'react';
import type {TDropdownGaugeItemProps, TDropdownGaugeProps} from '@common/types/types';

function DropdownItem({option}: TDropdownGaugeItemProps): ReactElement {
	const	balance = useBalance(option.value.tokenAddress);

	return (
		<Listbox.Option value={option}>
			{({active}): ReactElement => (
				<div data-active={active} className={'yearn--dropdown-menu-item hover:bg-neutral-0/40'}>
					<div className={'h-6 w-6 rounded-full'}>
						{option?.icon ? cloneElement(option.icon) : null}
					</div>
					<div>
						<p className={`${option.icon ? 'pl-2' : 'pl-0'} font-normal text-neutral-900`}>
							{option.label}
						</p>
						<p className={`${option.icon ? 'pl-2' : 'pl-0'} text-xxs font-normal text-neutral-600`}>
							{`${formatAmount(balance.normalized)} ${option.label}`}
						</p>
					</div>
				</div>
			)}
		</Listbox.Option>
	);
}

function DropdownEmpty(): ReactElement {
	const {isActive, openLoginModal} = useWeb3();

	if (!isActive) {
		return (
			<div
				onClick={(): void => openLoginModal()}
				className={'flex h-14 cursor-pointer flex-col items-center justify-center px-4 text-center transition-colors hover:bg-neutral-300'}>
				<b className={'text-neutral-900'}>{'Connect Wallet'}</b>
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
	defaultOption,
	selected,
	onSelect,
	placeholder = ''
}: TDropdownGaugeProps): ReactElement {
	const	[isOpen, set_isOpen] = useState(false);
	console.warn(isOpen);
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
			<Listbox
				value={selected}
				onChange={onSelect}>
				<>
					<Listbox.Button
						onClick={(): void => set_isOpen(!isOpen)}
						className={'flex h-10 w-full items-center justify-between bg-neutral-100 p-2 text-base text-neutral-900 md:px-3'}>
						<div className={'relative flex flex-row items-center'}>
							<div key={selected?.label} className={'h-6 w-6 rounded-full'}>
								{selected?.icon ? cloneElement(selected.icon) : <div className={'h-6 w-6 rounded-full bg-neutral-500'} />}
							</div>
							<p className={`pl-2 ${(!selected?.label && !defaultOption?.label) ? 'text-neutral-400' : 'text-neutral-900'} max-w-[90%] overflow-x-hidden text-ellipsis whitespace-nowrap font-normal scrollbar-none md:max-w-full`}>
								{selected?.label || defaultOption?.label || placeholder}
							</p>
						</div>
						<div className={'absolute right-2 md:right-3'}>
							<IconChevron
								className={`h-6 w-6 transition-transform ${isOpen ? '-rotate-180' : 'rotate-0'}`} />
						</div>
					</Listbox.Button>
					<Transition
						as={Fragment}
						show={isOpen}
						enter={'transition duration-100 ease-out'}
						enterFrom={'transform scale-95 opacity-0'}
						enterTo={'transform scale-100 opacity-100'}
						leave={'transition duration-75 ease-out'}
						leaveFrom={'transform scale-100 opacity-100'}
						leaveTo={'transform scale-95 opacity-0'}>
						<Listbox.Options static className={'yearn--dropdown-menu z-50'}>
							{options.length === 0 ? (
								<DropdownEmpty />
							): (
								options
									.map((option): ReactElement => (
										<DropdownItem 
											key={option.label}
											option={option} />
									)
									))}
						</Listbox.Options>
					</Transition>
				</>
			</Listbox>
		</div>
	);
}

export {Dropdown};
