import {useEffect, useState} from 'react';
import {Switch as HeadlessSwitch} from '@headlessui/react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {SearchBar} from '@common/components/SearchBar';
import {isValidCategory} from '@common/types/category';

import type {ChangeEvent, ReactElement, ReactNode} from 'react';

export type TListHeroCategory<T> = {
	label: string;
	node?: ReactNode;
	value: T;
	isSelected?: boolean,
}

type TSwitchProps = {
	isEnabled: boolean;
	onSwitch?: (state: boolean) => void;
}

export type TListHero<T> = {
	headLabel: string;
	switchProps?: TSwitchProps;
	searchLabel: string;
	searchPlaceholder: string;
	categories: TListHeroCategory<T>[][];
	onSelect: (category: T) => void;
	searchValue: string;
	set_searchValue: (searchValue: string) => void;
}

export type TListHeroDesktopCategories<T> = {
	categories: TListHeroCategory<T>[][];
	onSelect: (category: T) => void;
}

function DesktopCategories<T>({categories, onSelect}: TListHeroDesktopCategories<T>): ReactElement {
	const [isClientLoaded, set_isClientLoaded] = useState(false);
	useEffect((): void => {
		set_isClientLoaded(true);
	}, []);

	return (
		<div>
			<label className={'text-neutral-600'}>&nbsp;</label>
			<div className={'mt-1 flex flex-row space-x-4'}>
				{(categories || []).map((currentCategory, index: number): ReactElement => (
					<div
						key={`${index}-${isClientLoaded}`}
						className={'flex flex-row space-x-0 divide-x border-x border-neutral-900'}>
						{currentCategory.map((item): ReactElement => (
							<Button
								key={item.label}
								onClick={(): void => onSelect(item.value)}
								suppressHydrationWarning
								variant={item.isSelected ? 'filled' : 'outlined'}
								className={'yearn--button-smaller relative !border-x-0'}>
								{item?.node || item.label}
							</Button>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

function Switch(props: TSwitchProps): ReactElement {
	const {isEnabled, onSwitch} = props;
	const [isEnabledState, set_isEnabledState] = useState(isEnabled);

	function safeOnSwitch(): void {
		if (onSwitch) {
			onSwitch(!isEnabled);
		} else {
			set_isEnabledState(!isEnabledState);
		}
	}

	return (
		<div>
			<HeadlessSwitch
				checked={onSwitch ? isEnabled : isEnabledState}
				onChange={safeOnSwitch}
				onKeyDown={({keyCode}: {keyCode: number}): unknown => keyCode === 13 ? safeOnSwitch() : null}
				className={'yearn--next-switch'}>
				<span className={'sr-only'}>{'Use setting'}</span>
				<div
					aria-hidden={'true'}
					className={(onSwitch ? isEnabled : isEnabledState) ? 'translate-x-[14px]' : 'translate-x-0'} />
			</HeadlessSwitch>
		</div>
	);
}

function ListHero<T extends string>({
	headLabel,
	searchLabel,
	searchPlaceholder,
	categories,
	onSelect,
	searchValue,
	set_searchValue,
	switchProps
}: TListHero<T>): ReactElement {
	return (
		<div className={'flex flex-col items-start justify-between space-x-0 px-4 pb-2 pt-4 md:px-10 md:pb-8 md:pt-10'}>
			<div className={'mb-6'}>
				<h2
					suppressHydrationWarning
					className={'text-lg font-bold md:text-3xl'}>
					{headLabel}
				</h2>
			</div>

			<div className={'hidden w-full flex-row items-center justify-between space-x-4 md:flex'}>
				<SearchBar
					searchLabel={searchLabel}
					searchPlaceholder={searchPlaceholder}
					searchValue={searchValue}
					set_searchValue={set_searchValue} />

				{!!switchProps && (
					<div className={'mr-4 mt-7 flex h-full min-w-fit flex-row'}>
						<small className={'mr-2'}>{'Hide gauges with 0 votes'}</small>
						<Switch {...switchProps} />
					</div>
				)}

				<DesktopCategories
					categories={categories}
					onSelect={onSelect} />
			</div>

			<div className={'flex w-full flex-row space-x-2 md:hidden md:w-2/3'}>
				<select
					className={'yearn--button-smaller !w-[120%] border-none bg-neutral-900 text-neutral-0'}
					onChange={({target: {value}}): void => {
						if (isValidCategory<T>(value)) {
							onSelect(value);
						}
					}}>
					{categories.map((currentCategory): ReactNode => (
						currentCategory.map((item): ReactElement => (
							<option
								suppressHydrationWarning
								key={item.value}
								value={item.value}>
								{item.label}
							</option>
						))
					))}
				</select>
				<div className={'flex h-8 w-full items-center border border-neutral-0 bg-neutral-0 p-2 md:w-auto'}>
					<div className={'flex h-8 w-full flex-row items-center justify-between px-0 py-2'}>
						<input
							className={'w-full overflow-x-scroll border-none bg-transparent px-0 py-2 text-xs outline-none scrollbar-none'}
							type={'text'}
							placeholder={'Search'}
							value={searchValue}
							onChange={(e: ChangeEvent<HTMLInputElement>): void => set_searchValue(e.target.value)} />
					</div>
				</div>
			</div>
		</div>
	);
}
export default ListHero;
