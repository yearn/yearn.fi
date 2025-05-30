import {useState} from 'react';
import Image from 'next/image';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

import type {FC, ReactNode} from 'react';

type TFAQItem = {
	title: string;
	children: ReactNode;
	isOpen: boolean;
	onToggle: () => void;
};

const FAQItem: FC<TFAQItem> = ({title, children, isOpen, onToggle}) => {
	return (
		<div className={'w-full'}>
			<button
				onClick={onToggle}
				className={
					'flex w-full items-center justify-between rounded-lg bg-[#191919] px-6 py-5 text-white transition-colors hover:bg-[#2a2a2a]'
				}>
				<span className={'text-lg'}>{title}</span>
				<span
					className={'text-2xl transition-transform'}
					style={{transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)'}}>
					{'+'}
				</span>
			</button>
			{isOpen && (
				<div className={'mt-px rounded-b-lg bg-[#191919] px-6 py-4 text-base text-gray-300'}>{children}</div>
			)}
		</div>
	);
};

const faqData = [
	{
		title: 'What is a Yearn Vault?',
		content: (
			<p>
				{
					"Yearn Vaults are DeFi's yield-optimizing asset management platform. You deposit tokens, and our strategies automatically maximize your yields across various protocols."
				}
			</p>
		)
	},
	{
		title: 'What are the risks?',
		content: (
			<p>
				{
					'As with any DeFi protocol, there are smart contract risks. Yearn goes to great lengths to minimize these risks through thorough auditing and testing of all code before deployment.'
				}
			</p>
		)
	},
	{
		title: 'What is YFI?',
		content: (
			<p>
				{
					"YFI is Yearn's governance token. YFI holders can vote on proposals and shape the future of the protocol. It was launched with a fair distribution with no founder, investor or VC allocation."
				}
			</p>
		)
	},
	{
		title: 'Are there Developer Docs?',
		content: (
			<p>
				{
					'Yes! Yearn has extensive documentation for developers looking to build on top of our protocol. Visit our'
				}{' '}
				<a
					href={'https://docs.yearn.fi'}
					className={'text-blue-400 underline'}>
					{'docs'}
				</a>{' '}
				{'to learn more.'}
			</p>
		)
	}
];

export const FAQs: FC = () => {
	const [openFAQ, set_openFAQ] = useState<number | null>(null);

	const toggleFAQ = (index: number): void => {
		set_openFAQ(openFAQ === index ? null : index);
	};

	return (
		<section className={'flex w-full justify-center pb-8 pt-16 lg:pt-32'}>
			<div className={'flex w-full max-w-[1180px] flex-col items-center justify-between md:flex-row'}>
				<div className={'w-full px-4'}>
					<div className={'mb-10 flex flex-col justify-between gap-y-6 md:flex-row'}>
						<SectionHeader
							tagline={'Education'}
							title={'FAQs'}
							description={'Frequently asked questions about Yearn'}
							cta={{
								label: 'Learn More',
								href: '#'
							}}
						/>
					</div>
					<div className={'grid grid-cols-1 gap-8 md:grid-cols-2'}>
						<div className={'hidden h-[400px] md:block'}>
							<Image
								src={'/landing/footer-background.png'}
								width={600}
								height={600}
								alt={'Yearn Finance'}
								className={'size-full rounded-lg object-cover'}
							/>
						</div>
						<div className={'flex flex-col space-y-2'}>
							{faqData.map((faq, index) => (
								<FAQItem
									key={index}
									title={faq.title}
									isOpen={openFAQ === index}
									onToggle={() => toggleFAQ(index)}>
									{faq.content}
								</FAQItem>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
