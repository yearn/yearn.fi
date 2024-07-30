import {usePathname} from 'next/navigation';

import type {ReactElement} from 'react';

const TitlesDictionary: {[key: string]: string} = {
	'/': '',
	community: 'Community Apps',
	'yearn-x': 'Yearn X Partners'
};

export default function Index(): ReactElement {
	const pathName = usePathname();

	const currentTab = pathName?.startsWith('/home/') ? pathName?.split('/')[2] : '/';

	return (
		<div className={'my-20 flex w-full justify-center'}>
			<div className={'w-full max-w-6xl'}>
				<div className={'flex w-full justify-start'}>
					<p className={'text-[64px] font-bold leading-[64px] text-white'}>{TitlesDictionary[currentTab]}</p>
				</div>
			</div>
		</div>
	);
}
