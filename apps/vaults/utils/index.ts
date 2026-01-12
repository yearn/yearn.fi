export const getChainBgColor = (chainID: number): string => {
  switch (chainID) {
    case 1:
      return '#627EEA'
    case 10:
      return '#C80016'
    case 137:
      return 'linear-gradient(244deg, #7B3FE4 5.89%, #A726C1 94.11%)'
    case 250:
      return '#1969FF'
    case 8453:
      return '#1C55F5'
    case 42161:
      return '#2F3749'
    default:
      return '#627EEA'
  }
}
