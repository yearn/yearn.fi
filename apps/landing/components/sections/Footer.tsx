import {type ReactElement} from 'react';
import {FooterNav} from '@common/components/ModalMobileMenu';

export function Footer(): ReactElement {
	return (
		<div className="w-[1180px] bg-gray-600 flex flex-col md:flex-row items-center justify-between py-16">
			<FooterNav />
		</div>
	);
}
