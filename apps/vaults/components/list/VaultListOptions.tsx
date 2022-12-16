import React, {Fragment, useState} from 'react';
import {Popover, Switch as HeadlessSwitch, Transition} from '@headlessui/react';
import {useAppSettings} from '@vaults/contexts/useAppSettings';
import IconSettings from '@yearn-finance/web-lib/icons/IconSettings';

import type {ReactElement} from 'react';

type TSwitch = {
	isEnabled: boolean;
	onSwitch?: React.Dispatch<React.SetStateAction<boolean>>;
};

function Switch(props: TSwitch): ReactElement {
	const	{isEnabled, onSwitch} = props;
	const	[isEnabledState, set_isEnabledState] = useState(isEnabled);

	function	safeOnSwitch(): void {
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

export {Switch};

export default function VaultListOptions(): ReactElement {
	const	{shouldHideDust, onSwitchHideDust, shouldHideLowTVLVaults, onSwitchHideLowTVLVaults} = useAppSettings();

	return (
		<Popover className={'relative flex'}>
			{(): ReactElement => (
				<>
					<Popover.Button>
						<IconSettings className={'transition-color h-4 w-4 text-neutral-400 hover:text-neutral-900'} />
					</Popover.Button>
					<Transition
						as={Fragment}
						enter={'transition ease-out duration-200'}
						enterFrom={'opacity-0 translate-y-1'}
						enterTo={'opacity-100 translate-y-0'}
						leave={'transition ease-in duration-150'}
						leaveFrom={'opacity-100 translate-y-0'}
						leaveTo={'opacity-0 translate-y-1'}>
						<Popover.Panel className={'absolute right-0 top-6 z-[1000] mt-3 w-screen max-w-[180px] md:top-4 md:-right-4'}>
							<div className={'yearn--shadow overflow-hidden'}>
								<div className={'relative bg-neutral-0'}>
									<label className={'flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-neutral-100/40'}>
										<p className={'text-xs'}>{'Hide dust'}</p>
										<Switch
											isEnabled={shouldHideDust}
											onSwitch={onSwitchHideDust} />
									</label>

									<label className={'flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-neutral-100/40'}>
										<p className={'text-xs'}>{'Hide low TVL'}</p>
										<Switch
											isEnabled={shouldHideLowTVLVaults}
											onSwitch={onSwitchHideLowTVLVaults} />
									</label>
								</div>
							</div>
						</Popover.Panel>
					</Transition>
				</>
			)}
		</Popover>
	);
}
