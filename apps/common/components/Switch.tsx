import {useState} from 'react';
import {Switch as HeadlessSwitch} from '@headlessui/react';

import type {ReactElement} from 'react';

type TSwitch = {
	isEnabled: boolean;
	onSwitch?: React.Dispatch<React.SetStateAction<boolean>>;
};

function Switch(props: TSwitch): ReactElement {
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

export {Switch};
