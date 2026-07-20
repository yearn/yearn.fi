import { GET_CORS_HEADERS, json, noContent } from '../http'

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export function GET(): Response {
  const apiKey = process.env.ENSO_API_KEY
  const isConfigured = !!apiKey

  return json({ configured: isConfigured }, { headers: GET_CORS_HEADERS })
}

export default GET
