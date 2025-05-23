import Link from 'next/link';

import type {FC, ReactElement} from 'react';

export const SectionHeader: FC<{
	tagline?: string;
	title?: string;
	description?: ReactElement | string;
	cta?: {label: string; href: string};
	align?: 'left' | 'right' | 'center';
	isH1?: boolean;
}> = ({tagline, title, description, cta, align = 'left', isH1 = false}) => {
	return (
		<div
			className={`flex flex-col ${align === 'right' ? 'items-end' : align === 'center' ? 'items-center' : ''} gap-y-4`}>
			<div
				className={`flex flex-col ${align === 'right' ? 'items-end' : align === 'center' ? 'items-center' : ''}`}>
				{!!tagline && <p className={"mb-2 font-medium text-lightBlue-500"}>{tagline}</p>}
				{!!title &&
					(isH1 ? (
						<h1 className={"text-5xl font-medium md:text-6xl"}>{title}</h1>
					) : (
						<h2 className={"text-4xl font-medium md:text-5xl"}>{title}</h2>
					))}
			</div>
			{!!description && (
				<div>
					<p className={`text-steelGray-500 ${isH1 ? 'text-[18px] md:text-[24px]' : 'text-[18px]'}`}>
						{description}
						{!!cta && (
							<Link
								href={cta.href}
								className={"ml-2 text-white"}>
								{cta.label} {"→"}
							</Link>
						)}
					</p>
				</div>
			)}
		</div>
	);
};
