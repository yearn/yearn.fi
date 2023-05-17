import {z} from 'zod';

const resultSchema = z.object({
	duration: z.coerce.number().optional(),
	durationPR: z.coerce.number().optional(),
	APR: z.coerce.number()
});

const yDaemonReportSchema = z.object({
	id: z.string().optional(),
	debtAdded: z.string().optional(),
	debtLimit: z.string().optional(),
	totalDebt: z.string().optional(),
	gain: z.string().optional(),
	totalGain: z.string().optional(),
	loss: z.string().optional(),
	totalLoss: z.string().optional(),
	debtPaid: z.string().optional(),
	timestamp: z.coerce.number(),
	results: z.array(resultSchema).nullable()
});

export const yDaemonReportsSchema = z.array(yDaemonReportSchema);

export type TYDaemonReport = z.infer<typeof yDaemonReportSchema>;

export type TYDaemonReports = z.infer<typeof yDaemonReportsSchema>;
