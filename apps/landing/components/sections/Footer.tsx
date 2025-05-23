import {type ReactElement} from 'react';
import {FooterNav} from '@common/components/ModalMobileMenu';
import {LogoYearn} from '@common/icons/LogoYearn';

function FooterContent(): ReactElement {
	return (
		<>
			<div className={'mb-10 flex flex-col-reverse justify-between gap-y-6 md:flex-row'}>
				<div>
					<p className={'font-aeonikFono text-5xl'}>{'TAKE THE BLUE PILL.'}</p>
				</div>
				<div>
					<LogoYearn
						className={'size-14'}
						front={'text-white'}
						back={'text-primary'}
					/>
				</div>
			</div>
			<FooterNav onClose={() => {}} />
		</>
	);
}

export function Footer(): ReactElement {
	return (
		<div className={'flex w-full justify-center '}>
			<div
				style={{
					backgroundImage: "url('/landing/footer-background.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: 'auto 100%',
					backgroundPosition: 'center'
				}}
				className={
					'items-between relative m-6 hidden h-[640px] w-full max-w-[2352px] flex-col justify-between self-center rounded-lg border border-[#292929] bg-[#0C0E14] px-14 py-12 md:flex'
				}>
				<FooterContent />
			</div>
			<div
				style={{
					backgroundImage: "url('/landing/footer-background-mobile.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: 'cover',
					backgroundPosition: 'center'
				}}
				className={
					'items-between relative flex h-[680px] w-full max-w-[2352px] flex-col justify-between self-center rounded-lg bg-[#0C0E14] px-8 pb-10 pt-12 md:hidden'
				}>
				<FooterContent />
			</div>
		</div>
	);
}
