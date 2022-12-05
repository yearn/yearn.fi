import React, {cloneElement, Fragment, useMemo} from 'react';
import {Listbox, Transition} from '@headlessui/react';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import IconChevron from '@common/icons/IconChevron';

import type {ReactElement} from 'react';
import type {TDropdownItemProps, TDropdownProps, TSimplifiedBalanceData} from '@common/types/types';

function DropdownItem({
	option,
	balances
}: TDropdownItemProps): ReactElement {
	const	balance = useMemo((): TSimplifiedBalanceData | null => balances?.[toAddress(option.value)] || null, [balances, option.value]);

	return (
		<Listbox.Option value={option}>
			{({active}): ReactElement => (
				<div data-active={active} className={'yearn--dropdown-menu-item'}>
					<div className={'h-6 w-6 rounded-full'}>
						{option?.icon ? cloneElement(option.icon) : null}
					</div>
					<div>
						<p className={`${option.icon ? 'pl-2' : 'pl-0'} font-normal text-neutral-900`}>
							{option.symbol}
						</p>
						<p className={`${option.icon ? 'pl-2' : 'pl-0'} text-xxs font-normal text-neutral-600`}>
							{`${formatAmount(balance?.normalized || 0, 2, 2)} ${option.symbol}`}
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
	placeholder = '',
	balances
}: TDropdownProps): ReactElement {
	return (
		<div>
			<Listbox value={selected} onChange={onSelect}>
				{({open}): ReactElement => (
					<>
						<Listbox.Button
							className={'flex h-10 w-full items-center justify-between bg-neutral-100 p-2 text-base text-neutral-900 md:px-3'}>
							<div className={'relative flex flex-row items-center'}>
								<div className={'h-6 w-6 rounded-full'}>
									{selected?.icon ? cloneElement(selected.icon) : <div className={'h-6 w-6 rounded-full bg-neutral-500'} />}
								</div>
								<p className={`pl-2 ${(!selected?.symbol && !defaultOption?.symbol) ? 'text-neutral-400' : 'text-neutral-900'} max-w-[90%] overflow-x-hidden text-ellipsis whitespace-nowrap font-normal scrollbar-none md:max-w-full`}>
									{selected?.symbol || defaultOption?.symbol || placeholder}
								</p>
							</div>
							<div className={'absolute right-2 md:right-3'}>
								<IconChevron
									className={`h-6 w-6 transition-transform ${open ? '-rotate-180' : 'rotate-0'}`} />
							</div>
						</Listbox.Button>
						<Transition
							as={Fragment}
							show={open}
							enter={'transition duration-100 ease-out'}
							enterFrom={'transform scale-95 opacity-0'}
							enterTo={'transform scale-100 opacity-100'}
							leave={'transition duration-75 ease-out'}
							leaveFrom={'transform scale-100 opacity-100'}
							leaveTo={'transform scale-95 opacity-0'}>
							<Listbox.Options className={'yearn--dropdown-menu'}>
								{options.length === 0 ? (
									<DropdownEmpty />
								): (
									options.map((option, index): ReactElement => (
										<DropdownItem 
											key={option?.label || index}
											option={option}
											balances={balances} />
									)
									))}
							</Listbox.Options>
						</Transition>
					</>
				)}
			</Listbox>
		</div>
	);
}

export {Dropdown};