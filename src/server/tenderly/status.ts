import { GET_CORS_HEADERS, json, noContent } from '../http'
import { buildTenderlyPanelStatus } from '../tenderly.helpers'

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export function GET(): Response {
  try {
    return json(buildTenderlyPanelStatus(process.env), { headers: GET_CORS_HEADERS })
  } catch (error) {
    console.error('Error building Tenderly status:', error)
    return json(
      { error: error instanceof Error ? error.message : 'Failed to build Tenderly status' },
      { status: 500, headers: GET_CORS_HEADERS }
    )
  }
}

export default GET
