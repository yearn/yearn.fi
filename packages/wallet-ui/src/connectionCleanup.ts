import type { Config, Connector } from 'wagmi'
import { getAccount, getConnections } from 'wagmi/actions'

export async function restorePreviousAccount(
  config: Config,
  attempt: { connector: Connector; previousConnector?: Connector }
): Promise<void> {
  if (!getConnections(config).some(({ connector }) => connector.uid === attempt.connector.uid)) {
    return
  }
  const currentConnector = getAccount(config).connector
  const desiredAccount = {
    uid: currentConnector?.uid === attempt.connector.uid ? attempt.previousConnector?.uid : currentConnector?.uid
  }
  const unwatch = config.subscribe(
    ({ current, connections }) => ({ current, obsoleteConnected: connections.has(attempt.connector.uid) }),
    (account, previous) => {
      // Ignore Wagmi's automatic fallback when the obsolete connector disappears,
      // but retain user changes both before and after an early provider disconnect event.
      if (account.current !== previous.current && !(previous.obsoleteConnected && !account.obsoleteConnected)) {
        desiredAccount.uid = account.current ?? undefined
      }
    }
  )
  try {
    // The disconnect action snapshots all connections before awaiting the wallet.
    // Use the public connector lifecycle so removal uses Wagmi's current connections.
    await attempt.connector.disconnect()
    attempt.connector.emitter.emit('disconnect')
  } finally {
    unwatch()
  }
  // Wagmi disconnect selects the first remaining connection; restore the user's selection afterward.
  const desiredConnection = getConnections(config).find(({ connector }) => connector.uid === desiredAccount.uid)
  if (!desiredConnection) return
  // Select synchronously: switchAccount awaits storage and can overwrite a newer connection.
  config.setState((state) => ({ ...state, current: desiredConnection.connector.uid }))
  await config.storage?.setItem('recentConnectorId', desiredConnection.connector.id)
  // A newer connection may settle during persistence; reconnect must follow that wallet too.
  const currentConnectorAfterStorage = getAccount(config).connector
  if (currentConnectorAfterStorage && currentConnectorAfterStorage.uid !== desiredConnection.connector.uid) {
    await config.storage?.setItem('recentConnectorId', currentConnectorAfterStorage.id)
  }
}
