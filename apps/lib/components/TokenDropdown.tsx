import {cloneElement, Fragment, useState} from 'react';
import {Combobox, Transition} from '@headlessui/react';
import {useThrottledState} from '@react-hookz/web';
import {Renderable} from '@lib/components/Renderable';
import {useWeb3} from '@lib/contexts/useWeb3';
import {useYearn} from '@lib/contexts/useYearn';
import {IconChevron} from '@lib/icons/IconChevron';
import {cl, formatAmount} from '@lib/utils';

import type {ReactElement} from 'react';
import type {TDropdownItemProps, TDropdownOption, TDropdownProps} from '@lib/types';

function DropdownItem({option}: TDropdownItemProps): ReactElement {
	const {getBalance} = useYearn();
	const balance = getBalance({address: option.value, chainID: option.chainID});

	return (
		<Combobox.Option value={option}>
			{({active}): ReactElement => (
				<div
					data-active={active}
					className={'yearn--dropdown-menu-item w-full hover:bg-neutral-0/40'}>
					<div className={'size-6 flex-none rounded-full'}>{option?.icon ? option.icon : null}</div>
					<div>
						<p className={`${option.icon ? 'pl-2' : 'pl-0'} font-normal text-neutral-900`}>
							{option.symbol}
						</p>
						<p className={`${option.icon ? 'pl-2' : 'pl-0'} text-xxs font-normal text-neutral-600`}>
							{`${formatAmount(balance.normalized)} ${option.symbol}`}
						</p>
					</div>
				</div>
			)}
		</Combobox.Option>
	);
}

function DropdownEmpty({query}: {query: string}): ReactElement {
	const {isActive, openLoginModal} = useWeb3();

	if (!isActive) {
		return (
			<div
				onClick={(): void => openLoginModal()}
				className={
					'flex h-14 cursor-pointer flex-col items-center justify-center px-4 text-center transition-colors hover:bg-neutral-300'
				}>
				<b className={'text-neutral-900'}>{'Connect Wallet'}</b>
			</div>
		);
	}
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

export function Dropdown(props: TDropdownProps): ReactElement {
	const [isOpen, set_isOpen] = useThrottledState(false, 400);
	const [query, set_query] = useState('');

	const filteredOptions =
		query === ''
			? props.options
			: props.options.filter((option): boolean => {
					return option.symbol.toLowerCase().includes(query.toLowerCase());
				});

	return (
		<div>
			<Renderable shouldRender={isOpen}>
				<div
					className={'fixed inset-0 z-0'}
					onClick={(e): void => {
						e.stopPropagation();
						e.preventDefault();
						set_isOpen(false);
					}}
				/>
			</Renderable>

			<Combobox
				value={props.selected}
				onChange={(_selected: TDropdownOption): void => {
					props.onSelect(_selected);
					set_isOpen(false);
				}}>
				<>
					<Combobox.Button
						onClick={(): void => set_isOpen((o: boolean): boolean => !o)}
						className={cl(
							props.className,
							'flex h-10 w-full items-center justify-between bg-neutral-0 p-2 text-base text-neutral-900 md:px-3'
						)}>
						<div className={'relative w-full'}>
							<div className={'flex w-full items-center'}>
								<div
									key={props.selected?.label}
									className={'size-6 flex-none rounded-full'}>
									{props.selected?.icon ? (
										cloneElement(props.selected.icon)
									) : (
										<div className={'size-6 flex-none rounded-full bg-neutral-500'} />
									)}
								</div>
								<p
									className={
										'whitespace-nowrap px-2 font-normal text-neutral-900 scrollbar-none md:max-w-full'
									}>
									<Combobox.Input
										className={
											'w-full cursor-default text-ellipsis border-none bg-transparent p-0 outline-none scrollbar-none'
										}
										displayValue={(option: TDropdownOption): string => option?.symbol}
										placeholder={props.placeholder || ''}
										spellCheck={false}
										onChange={(event): void => {
											set_isOpen(true);
											set_query(event.target.value);
										}}
									/>
								</p>
								<div className={'ml-auto'}>
									<IconChevron
										aria-hidden={'true'}
										className={`size-4 text-neutral-900/50 transition-transform${isOpen ? '-rotate-180' : 'rotate-0'}`}
									/>
								</div>
							</div>
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
							set_query('');
						}}>
						<Combobox.Options className={cl(props.comboboxOptionsClassName, 'yearn--dropdown-menu z-50')}>
							<Renderable
								shouldRender={filteredOptions.length > 0}
								fallback={<DropdownEmpty query={query} />}>
								{filteredOptions.map(
									(option): ReactElement => (
										<DropdownItem
											key={option.label}
											option={option}
										/>
									)
								)}
							</Renderable>
						</Combobox.Options>
					</Transition>
				</>
			</Combobox>
		</div>
	);
}
