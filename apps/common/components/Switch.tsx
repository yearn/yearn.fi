import {useState} from 'react';
import {useRouter} from 'next/router';
import {cl} from '@builtbymom/web3/utils';
import {Switch as HeadlessSwitch} from '@headlessui/react';

import type {KeyboardEvent, ReactElement} from 'react';

type TSwitch = {
	isEnabled: boolean;
	onSwitch?: () => void;
};

export function Switch(props: TSwitch): ReactElement {
	const {isEnabled, onSwitch} = props;
	const [isEnabledState, set_isEnabledState] = useState(isEnabled);
	const {pathname} = useRouter();
	const isV3Page = pathname.startsWith(`/v3`);

	function safeOnSwitch(): void {
		onSwitch ? onSwitch() : set_isEnabledState(!isEnabledState);
	}

	const isChecked = onSwitch ? isEnabled : isEnabledState;

	function handleOnKeyDown({key}: KeyboardEvent<HTMLButtonElement>): void | null {
		if (key !== 'Enter') {
			return;
		}

		safeOnSwitch();
	}

	return (
		<div>
			<HeadlessSwitch
				checked={isChecked}
				onChange={safeOnSwitch}
				onKeyDown={handleOnKeyDown}
				className={cl(isV3Page ? 'yearn--next-switch' : 'yearn--next-switch-v2')}>
				<span className={'sr-only'}>{'Use setting'}</span>
				<div aria-hidden={'true'} />
			</HeadlessSwitch>
		</div>
	);
}
