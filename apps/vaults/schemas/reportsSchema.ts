import {z} from 'zod';

const ResultSchema = z.object({
	duration: z.string(),
	durationPR: z.string(),
	APR: z.string()
});

const ReportSchema = z.object({
	id: z.string(),
	debtAdded: z.string(),
	debtLimit: z.string(),
	totalDebt: z.string(),
	gain: z.string(),
	totalGain: z.string(),
	loss: z.string(),
	totalLoss: z.string(),
	debtPaid: z.string(),
	timestamp: z.string(),
	results: z.array(ResultSchema)
});

export const ReportsSchema = z.array(ReportSchema);

export type TYDaemonReports = z.infer<typeof ReportSchema>;
