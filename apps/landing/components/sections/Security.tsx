import {FC} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

export const Security: FC = () => {
	return (
		<section className="flex justify-center w-full bg-gray-500">
			<div className="w-[1180px] bg-gray-600 flex flex-col md:flex-row items-center justify-between py-16">
				<div className="max-w-7xl w-full px-4">
					<SectionHeader
						align="center"
						tagline="Audited, secure"
						title="Security First"
					/>

					<div className="grid md:grid-cols-2 gap-6 pt-8">
						{/* Audits Card */}
						<div className="rounded-2xl overflow-hidden bg-[#2a2c4a]">
							<div className="p-12 flex justify-center">
								<Image
									src="/landing/yearn-apps-logo.png"
									width={180}
									height={180}
									alt="Yearn Audits"
									className="w-auto h-auto"
								/>
							</div>
							<div className="bg-[#333761] p-8">
								<h3 className="text-3xl mb-4">Audits</h3>
								<p className="text-gray-300 mb-4">
									Yearn Contracts are audited thoroughly by a variety of auditors.
								</p>
								<Link
									href="#"
									className="text-[#4a5aef] flex items-center">
									Learn More
									<svg
										className="ml-2 w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										xmlns="http://www.w3.org/2000/svg">
										<path
											d="M5 12H19M19 12L12 5M19 12L12 19"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</Link>
							</div>
						</div>

						{/* Bug Bounties Card */}
						<div className="rounded-2xl overflow-hidden bg-[#103042]">
							<div className="p-12 flex justify-center">
								<Image
									src="/landing/integrations.png"
									width={180}
									height={180}
									alt="Bug Bounties"
									className="w-auto h-auto"
								/>
							</div>
							<div className="bg-[#164156] p-8">
								<h3 className="text-3xl mb-4">Bug Bounties</h3>
								<p className="text-gray-300 mb-4">
									Security is our top priority. Report vulnerabilities and get rewarded.
								</p>
								<Link
									href="#"
									className="text-[#4a5aef] flex items-center">
									Learn More
									<svg
										className="ml-2 w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										xmlns="http://www.w3.org/2000/svg">
										<path
											d="M5 12H19M19 12L12 5M19 12L12 19"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</Link>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
