import type { VercelRequest, VercelResponse } from '@vercel/node'
import { deleteStaleCache, ensureSchemaInitialized } from '../lib/holdings'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Chores] CRON_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await ensureSchemaInitialized()
    const deletedCount = await deleteStaleCache()

    return res.status(200).json({
      success: true,
      deletedRows: deletedCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Chores] Failed to run cleanup:', error)
    return res.status(500).json({ error: 'Cleanup failed' })
  }
}
