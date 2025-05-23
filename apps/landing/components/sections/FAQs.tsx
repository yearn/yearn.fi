import {FC, ReactNode, useState} from 'react';
import Image from 'next/image';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

type FAQItemProps = {
	title: string;
	children: ReactNode;
	isOpen: boolean;
	onToggle: () => void;
};

const FAQItem: FC<FAQItemProps> = ({title, children, isOpen, onToggle}) => {
	return (
		<div className="w-full">
			<button
				onClick={onToggle}
				className="flex w-full items-center justify-between rounded-lg py-5 px-6 bg-[#191919] hover:bg-[#2a2a2a] transition-colors text-white">
				<span className="text-lg">{title}</span>
				<span
					className="text-2xl transition-transform"
					style={{transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)'}}>
					+
				</span>
			</button>
			{isOpen && (
				<div className="py-4 px-6 bg-[#191919] text-gray-300 text-base mt-[1px] rounded-b-lg">{children}</div>
			)}
		</div>
	);
};

const faqData = [
	{
		title: 'What is a Yearn Vault?',
		content: (
			<p>
				Yearn Vaults are DeFi's yield-optimizing asset management platform. You deposit tokens, and our
				strategies automatically maximize your yields across various protocols.
			</p>
		)
	},
	{
		title: 'What are the risks?',
		content: (
			<p>
				As with any DeFi protocol, there are smart contract risks. Yearn goes to great lengths to minimize these
				risks through thorough auditing and testing of all code before deployment.
			</p>
		)
	},
	{
		title: 'What is YFI?',
		content: (
			<p>
				YFI is Yearn's governance token. YFI holders can vote on proposals and shape the future of the protocol.
				It was launched with a fair distribution with no founder, investor or VC allocation.
			</p>
		)
	},
	{
		title: 'Are there Developer Docs?',
		content: (
			<p>
				Yes! Yearn has extensive documentation for developers looking to build on top of our protocol. Visit our{' '}
				<a
					href="https://docs.yearn.fi"
					className="text-blue-400 underline">
					docs
				</a>{' '}
				to learn more.
			</p>
		)
	}
];

export const FAQs: FC = () => {
	const [openFAQ, setOpenFAQ] = useState<number | null>(null);

	const toggleFAQ = (index: number) => {
		setOpenFAQ(openFAQ === index ? null : index);
	};

	return (
		<section className="flex justify-center w-full ">
			<div className="w-[1180px] flex flex-col md:flex-row items-center justify-between py-16">
				<div className="w-full px-4">
					<div className="mb-10 flex flex-col justify-between gap-y-6 md:flex-row">
						<SectionHeader
							tagline="Education"
							title="FAQs"
							description={'Frequently asked questions about Yearn'}
							cta={{
								label: 'Learn More',
								href: '#'
							}}
						/>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<div className="h-[400px]">
							<Image
								src="/landing/footer-background.png"
								width={600}
								height={600}
								alt="Yearn Finance"
								className="rounded-lg w-full h-full object-cover"
							/>
						</div>
						<div className="flex flex-col space-y-2">
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
