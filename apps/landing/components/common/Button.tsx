import {cl} from 'builtbymom-web3-fork/utils';

import type {ButtonHTMLAttributes, ReactElement} from 'react';

const STYLE = {
	primary: 'bg-primary hover:bg-[#004BE0]',
	secondary: 'bg-transparent border border-white/30 hover:bg-white/10'
};

export function Button(
	props: {variant?: 'primary' | 'secondary'} & ButtonHTMLAttributes<HTMLButtonElement>
): ReactElement {
	const {variant = 'primary', ...rest} = props;

	return (
		<button
			{...rest}
			className={cl('py-3 px-4 text-white rounded-[4px] transition-colors', STYLE[variant], rest.className)}>
			{rest.children}
		</button>
	);
}
