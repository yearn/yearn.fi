import React, {useMemo, useState} from 'react';
import Balancer from 'react-wrap-balancer';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';
import {Switch} from '@common/components/Switch';

import type {ReactElement} from 'react';

type TWrappedInput = {
	title: string;
	initialValue: string;
	onSave: (value: string) => void;
}

function	WrappedInput({title, initialValue, onSave}: TWrappedInput): ReactElement {
	const	[isFocused, set_isFocused] = useState(false);
	const	[value, set_value] = useState(initialValue);
	const	isInitialValue = useMemo((): boolean => value === initialValue, [value, initialValue]);

	return (
		<label>
			<p className={'pb-1 text-neutral-900'}>{title}</p>
			<div className={'flex flex-row space-x-2'}>
				<div data-focused={isFocused} className={'yearn--input relative w-full'}>
					<input
						onFocus={(): void => set_isFocused(true)}
						onBlur={(): void => set_isFocused(false)}
						className={'h-10 w-full overflow-x-scroll border-2 border-neutral-700 bg-neutral-0 p-2 outline-none scrollbar-none'}
						placeholder={'Use default'}
						value={value}
						type={'text'}
						onChange={(e): void => set_value(e.target.value)}
					/>
				</div>
				<Button
					isDisabled={isInitialValue}
					className={'w-full md:w-48'}
					onClick={(): void => onSave(value)}>
					{'Submit'}
				</Button>
			</div>
		</label>
	);
}

function	SettingsOverwrite(): ReactElement {
	const	{onUpdateBaseSettings, onUpdateNetworks, settings: baseAPISettings} = useSettings();
	const 	[isPopoverHidden, set_isPopoverHidden] = useLocalStorage<boolean>('yearn.finance/feedback-popover', true);
	const	[, set_nonce] = useState(0);

	return (
		<div className={'bg-neutral-100 p-10'}>
			<div className={'flex w-full flex-row justify-between pb-6'}>
				<h2 className={'text-3xl font-bold'}>
					{'Settings'}
				</h2>
			</div>
			<div className={'text-justify'}>
				<p className={'pb-6'}>
					<Balancer>
						{'Configure the default settings for this application, such as the '}
						<a
							href={'https://ydaemon.yearn.farm'}
							target={'_blank'}
							className={'text-neutral-900 underline'}
							rel={'noreferrer'}>{'yDaemon API'}
						</a>
						{' base URI and the default network.'}
					</Balancer>
				</p>
				<div className={'grid grid-cols-1 gap-4'}>
					<WrappedInput
						title={'yDaemon API URI'}
						initialValue={baseAPISettings.yDaemonBaseURI}
						onSave={(value): void => onUpdateBaseSettings({
							...baseAPISettings,
							yDaemonBaseURI: value
						})} />
					<WrappedInput
						title={'Ethereum RPC endpoint'}
						initialValue={''}
						onSave={(value): void => {
							onUpdateNetworks({1: {rpcURI: value}});
							set_nonce((n: number): number => n + 1);
						}} />
				</div>
				<div className={'grid grid-cols-1 gap-4'}>
					<label className={'flex cursor-pointer items-center justify-between pt-4 transition-colors hover:bg-neutral-100/40'}>
						<p>{'Show feedback popover'}</p>
						<Switch
							isEnabled={!isPopoverHidden}
							onSwitch={(v): void => set_isPopoverHidden(!v)} />
					</label>
				</div>
			</div>
		</div>
	);
}

export default SettingsOverwrite;
