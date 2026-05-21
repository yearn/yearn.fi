import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getHoldingsProgress } from '../lib/holdings/services/progress'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.query.id
  const address = req.query.address
  const route = req.query.route

  if (typeof id !== 'string' || typeof address !== 'string' || typeof route !== 'string') {
    return res.status(400).json({ error: 'Missing required parameters: id, address, route' })
  }

  const progress = await getHoldingsProgress({ id, route, address })

  if (!progress) {
    return res.status(404).json({ error: 'Progress not found' })
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(progress)
}
