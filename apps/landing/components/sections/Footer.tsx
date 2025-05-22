import {type ReactElement} from 'react';
import {FooterNav} from '@common/components/ModalMobileMenu';

export function Footer(): ReactElement {
	return (
		<div className="w-[1180px] px-4 flex flex-col md:flex-row items-center justify-between pb-16">
			<FooterNav />
		</div>
	);
}
