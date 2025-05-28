import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {Combobox, Transition} from '@headlessui/react';
import {useClickOutside, useThrottledState} from '@react-hookz/web';
import {Renderable} from '@lib/components/Renderable';
import {useWeb3} from '@lib/contexts/useWeb3';
import {IconChevron} from '@lib/icons/IconChevron';
import {cl} from '@lib/utils';

import type {ReactElement} from 'react';

export type TMultiSelectOptionProps = {
	label: string;
	value: number | string;
	isSelected: boolean;
	icon?: ReactElement;
	onCheckboxClick?: (event: React.MouseEvent<HTMLElement>) => void;
	onContainerClick?: (event: React.MouseEvent<HTMLElement>) => void;
};

type TMultiSelectProps = {
	options: TMultiSelectOptionProps[];
	placeholder?: string;
	onSelect: (options: TMultiSelectOptionProps[]) => void;
	buttonClassName?: string;
	comboboxOptionsClassName?: string;
	customRender?: ReactElement;
	customDefaultLabel?: string;
};

function SelectAllOption(option: TMultiSelectOptionProps): ReactElement {
	return (
		<Combobox.Option
			value={option}
			className={'mb-2 border-b border-neutral-100 pb-2'}>
			<div className={'flex w-full items-center justify-between p-2 transition-colors hover:bg-neutral-100'}>
				<p className={'pl-0 font-normal text-neutral-900'}>{option.label}</p>
				<input
					type={'checkbox'}
					checked={option.isSelected}
					onChange={(): void => {}}
					className={'checkbox hidden'}
				/>
			</div>
		</Combobox.Option>
	);
}

function Option(option: TMultiSelectOptionProps): ReactElement {
	const [isHovered, set_isHovered] = useState(false);

	return (
		<Combobox.Option
			onClick={option.onContainerClick}
			value={option}
			className={'transition-colors hover:bg-neutral-100'}>
			<div
				className={'flex w-full items-center justify-between p-2'}
				onMouseEnter={() => set_isHovered(true)}
				onMouseLeave={() => set_isHovered(false)}>
				<div className={'flex items-center'}>
					{option?.icon ? (
						<div className={'size-8 overflow-hidden rounded-full bg-white'}>{option.icon}</div>
					) : null}
					<p className={`${option.icon ? 'pl-2' : 'pl-0'} font-normal text-neutral-900`}>
						{option.label}{' '}
						<span
							className={`pl-1 text-xs text-neutral-900 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
							{'(only)'}
						</span>
					</p>
				</div>
				<input
					onMouseEnter={() => set_isHovered(false)}
					onMouseLeave={() => set_isHovered(true)}
					type={'checkbox'}
					checked={option.isSelected}
					onChange={(): void => {}}
					className={'checkbox'}
					onClick={(event: React.MouseEvent<HTMLElement>): void => {
						event.stopPropagation();
						option.onCheckboxClick?.(event);
					}}
					readOnly
				/>
			</div>
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
					<p className={'text-sm text-neutral-400'}>{'Nothing found.'}</p>
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

const getFilteredOptions = ({
	query,
	currentOptions
}: {
	query: string;
	currentOptions: TMultiSelectOptionProps[];
}): TMultiSelectOptionProps[] => {
	if (query === '') {
		return currentOptions;
	}

	return currentOptions.filter((option): boolean => {
		return option.label.toLowerCase().includes(query.toLowerCase());
	});
};

export function MultiSelectDropdown({
	options,
	onSelect,
	placeholder = '',
	customDefaultLabel = 'All',
	customRender,
	...props
}: TMultiSelectProps): ReactElement {
	const [isOpen, set_isOpen] = useThrottledState(false, 400);
	const [query, set_query] = useState('');
	const areAllSelected = useMemo((): boolean => options.every(({isSelected}): boolean => isSelected), [options]);
	const componentRef = useRef(null);

	useClickOutside(componentRef, (): void => {
		set_isOpen(false);
	});

	const filteredOptions = useMemo(
		(): TMultiSelectOptionProps[] => getFilteredOptions({query, currentOptions: options}),
		[options, query]
	);

	const getDisplayName = useCallback(
		(options: TMultiSelectOptionProps[]): string => {
			if (areAllSelected) {
				return customDefaultLabel;
			}

			const selectedOptions = options.filter(({isSelected}): boolean => isSelected);

			if (selectedOptions.length === 0) {
				return placeholder;
			}

			if (selectedOptions.length === 1) {
				return selectedOptions[0].label;
			}

			return 'Multiple';
		},
		[areAllSelected, placeholder, customDefaultLabel]
	);

	const handleOnCheckboxClick = useCallback(
		({value}: TMultiSelectOptionProps): void => {
			const currentState = options.map(
				(o): TMultiSelectOptionProps => (o.value === value ? {...o, isSelected: !o.isSelected} : o)
			);
			onSelect(currentState);
		},
		[options, onSelect]
	);

	const handleOnContainerClick = useCallback(
		({value}: TMultiSelectOptionProps): void => {
			const currentState = options.map(
				(o): TMultiSelectOptionProps =>
					o.value === value ? {...o, isSelected: true} : {...o, isSelected: false}
			);
			onSelect(currentState);
		},
		[options, onSelect]
	);

	return (
		<Combobox
			ref={componentRef}
			value={options}
			onChange={(options): void => {
				// Just used for the select/desect all options
				const lastIndex = options.length - 1;
				const elementSelected = options[lastIndex];

				if (elementSelected.value !== 'select_all') {
					return;
				}

				const currentElements = options.slice(0, lastIndex);
				const currentState = currentElements.map(
					(option): TMultiSelectOptionProps => ({
						...option,
						isSelected: !elementSelected.isSelected
					})
				);
				onSelect(currentState);
			}}
			multiple>
			<div className={'relative w-full'}>
				{customRender ? (
					<Combobox.Button
						className={'flex items-center justify-between'}
						onClick={(): void => set_isOpen((o: boolean): boolean => !o)}>
						{customRender}
					</Combobox.Button>
				) : (
					<Combobox.Button
						onClick={(): void => set_isOpen((o: boolean): boolean => !o)}
						className={cl(
							props.buttonClassName,
							'flex h-10 w-full items-center justify-between bg-neutral-0 p-2 text-base text-neutral-900 md:px-3'
						)}>
						<Combobox.Input
							className={cl(
								'w-full cursor-default overflow-x-scroll border-none bg-transparent p-0 outline-none scrollbar-none',
								options.every(({isSelected}): boolean => !isSelected)
									? 'text-neutral-400'
									: 'text-neutral-900'
							)}
							displayValue={getDisplayName}
							placeholder={placeholder}
							spellCheck={false}
							onChange={(event): void => set_query(event.target.value)}
						/>
						<IconChevron
							aria-hidden={'true'}
							className={`size-6 transition-transform${isOpen ? '-rotate-180' : 'rotate-0'}`}
						/>
					</Combobox.Button>
				)}
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
					<Combobox.Options
						className={cl(
							props.comboboxOptionsClassName,
							'absolute top-12 z-50 flex w-full min-w-[256px] cursor-pointer flex-col overflow-y-auto bg-neutral-0 px-2 py-3 scrollbar-none'
						)}>
						<SelectAllOption
							key={'select-all'}
							label={areAllSelected ? 'Unselect All' : 'Select All'}
							isSelected={areAllSelected}
							value={'select_all'}
						/>
						<Renderable
							shouldRender={filteredOptions.length > 0}
							fallback={<DropdownEmpty query={query} />}>
							{filteredOptions.map(
								(option): ReactElement => (
									<Option
										key={option.value}
										onCheckboxClick={(): void => handleOnCheckboxClick(option)}
										onContainerClick={(): void => handleOnContainerClick(option)}
										{...option}
									/>
								)
							)}
						</Renderable>
					</Combobox.Options>
				</Transition>
			</div>
		</Combobox>
	);
}
