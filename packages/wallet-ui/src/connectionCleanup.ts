import type { Config, Connector } from 'wagmi'
import { disconnect, getAccount, getConnections, switchAccount, watchAccount } from 'wagmi/actions'

export async function restorePreviousAccount(
  config: Config,
  attempt: { connector: Connector; previousConnector?: Connector }
): Promise<void> {
  if (!getConnections(config).some(({ connector }) => connector.uid === attempt.connector.uid)) {
    return
  }
  const currentConnector = getAccount(config).connector
  const desiredAccount = {
    connector: currentConnector?.uid === attempt.connector.uid ? attempt.previousConnector : currentConnector
  }
  const unwatch = watchAccount(config, {
    onChange(account) {
      // Preserve user changes during async disconnect, before Wagmi removes the obsolete connection.
      if (getConnections(config).some(({ connector }) => connector.uid === attempt.connector.uid)) {
        desiredAccount.connector = account.connector
      }
    }
  })
  try {
    await disconnect(config, { connector: attempt.connector })
  } finally {
    unwatch()
  }
  // Wagmi disconnect selects the first remaining connection; restore the user's selection afterward.
  if (
    desiredAccount.connector &&
    getConnections(config).some(({ connector }) => connector.uid === desiredAccount.connector?.uid)
  ) {
    await switchAccount(config, { connector: desiredAccount.connector })
  }
}
