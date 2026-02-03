import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.ENSO_API_KEY
  const isConfigured = !!apiKey

  return res.status(200).json({ configured: isConfigured })
}
