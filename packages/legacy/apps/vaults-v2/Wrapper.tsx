import type {ReactElement} from 'react';

export function Wrapper({children}: {children: ReactElement}): ReactElement {
	return <div className={'mx-auto my-0 max-w-6xl pt-4 md:mb-0 md:mt-16'}>{children}</div>;
}
