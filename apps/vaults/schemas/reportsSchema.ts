import {z} from 'zod';

const resultSchema = z.object({
	duration: z.string().optional(),
	durationPR: z.string().optional(),
	APR: z.string()
});

const reportSchema = z.object({
	id: z.string().optional(),
	debtAdded: z.string().optional(),
	debtLimit: z.string().optional(),
	totalDebt: z.string().optional(),
	gain: z.string().optional(),
	totalGain: z.string().optional(),
	loss: z.string().optional(),
	totalLoss: z.string().optional(),
	debtPaid: z.string().optional(),
	timestamp: z.string(),
	results: z.array(resultSchema)
});

export const yDaemonReportsSchema = z.array(reportSchema);

export type TYDaemonReports = z.infer<typeof reportSchema>;
