export function shouldRequestPortfolioEntryRefresh({
  isActive,
  hasRequestedRefresh
}: {
  isActive: boolean
  hasRequestedRefresh: boolean
}) {
  return isActive && !hasRequestedRefresh
}
