export function isSafeConnectorId(connectorId?: string): boolean {
  return connectorId?.toLowerCase() === 'safe'
}
