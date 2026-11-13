export const counterValueAt = (snapshot, timestamp) => {
  const { anchor, growth } = snapshot
  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(anchor?.timestamp) ||
    !Number.isFinite(anchor?.valueUsd) ||
    anchor.valueUsd < 0 ||
    !Number.isFinite(growth?.estimatedUsdPerSecond)
  )
    throw new Error('Invalid TVL counter snapshot')
  const value = anchor.valueUsd + growth.estimatedUsdPerSecond * Math.max(0, timestamp - anchor.timestamp)
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid projected TVL value')
  return value
}
