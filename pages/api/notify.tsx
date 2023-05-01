import formidable from 'formidable';
import {Input, Telegram} from 'telegraf';

import type {NextApiRequest, NextApiResponse} from 'next';


type TRequest = {
	body: {
		screenshot?: string;
		messages?: string;
	};
} & NextApiRequest

export default async function handler(req: TRequest, res: NextApiResponse<boolean>): Promise<void> {
	const telegram = new Telegram(process.env.TELEGRAM_BOT as string);
	try {
		const form = formidable();
		const formData = await new Promise(async (resolve, reject): Promise<void> => {
			form.parse(req, async (err: Error, fields: unknown, files: unknown): Promise<void> => {
				if (err) {
					reject('error');
				}
				resolve({fields, files});
			});
		});
		const {fields, files} = await formData as any;
		const {screenshot} = files;
		await telegram.sendPhoto(
			process.env.TELEGRAM_CHAT as string,
			Input.fromLocalFile(screenshot.filepath),
			{
				caption: fields.messages,
				parse_mode: 'Markdown'
			}
		);
		return res.status(200).json(true);
	} catch (error) {
		console.error(error);
		return res.status(500).json(false);
	}
}

export const config = {
	api: {
		bodyParser: false
	}
};
