import {FC, ReactNode, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

type FAQItemProps = {
	title: string;
	children: ReactNode;
	initialOpen?: boolean;
};

const FAQItem: FC<FAQItemProps> = ({title, children, initialOpen = false}) => {
	const [isOpen, setIsOpen] = useState(initialOpen);

	return (
		<div className="w-full">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex w-full items-center justify-between rounded-lg py-5 px-6 bg-[#191919] text-white">
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

export const FAQs: FC = () => {
	return (
		<section className="flex justify-center w-full ">
			<div className="w-[1180px] flex flex-col md:flex-row items-center justify-between py-16">
				<div className="w-full px-4">
					<div className="mb-10 flex flex-col justify-between gap-y-6 md:flex-row">
						<SectionHeader
							tagline="Education"
							title="FAQs"
							description={'Collaborations exploring yield opportunities with our partners'}
							cta={{
								label: 'Learn More',
								href: '#'
							}}
						/>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<div className="h-full">
							<Image
								src="/landing/footer-background.png"
								width={600}
								height={600}
								alt="Yearn Finance"
								className="rounded-lg w-full h-full object-cover"
							/>
						</div>
						<div className="flex flex-col space-y-2">
							<FAQItem title="What is a Yearn Vault?">
								<p>
									Yearn Vaults are like crypto allocators in cyberspace. You deposit your assets, and
									Yearn's smart contracts put them to work within the DeFi ecosystem, returning the
									earned yield back to you.
								</p>
							</FAQItem>

							<FAQItem title="What are the risks?">
								<p>
									As with any DeFi protocol, there are smart contract risks. Yearn goes to great
									lengths to minimize these risks through thorough auditing and testing of all code
									before deployment.
								</p>
							</FAQItem>

							<FAQItem title="What is YFI?">
								<p>
									YFI is Yearn's governance token. YFI holders can vote on proposals and shape the
									future of the protocol. It was launched with a fair distribution with no founder,
									investor or VC allocation.
								</p>
							</FAQItem>

							<FAQItem title="Are there Developer Docs?">
								<p>
									Yes! Yearn has extensive documentation for developers looking to build on top of our
									protocol. Visit our{' '}
									<a
										href="https://docs.yearn.fi"
										className="text-blue-400 underline">
										docs
									</a>{' '}
									to learn more.
								</p>
							</FAQItem>

							<FAQItem title="What is a Yearn Vault?">
								<p>
									Yearn Vaults are DeFi's yield-optimizing asset management platform. You deposit
									tokens, and our strategies automatically maximize your yields across various
									protocols.
								</p>
							</FAQItem>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
