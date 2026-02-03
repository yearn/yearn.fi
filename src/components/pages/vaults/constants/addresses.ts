export const KATANA_CHAIN_ID = 747474

/**************************************************************************************************
 ** Vault addresses eligible for Spectra boost on Katana chain
 *************************************************************************************************/
export const SPECTRA_MARKET_VAULT_ADDRESSES = [
  '0x80c34BD3A3569E126e7055831036aa7b212cB159', //vbUSDC
  '0xE007CA01894c863d7898045ed5A3B4Abf0b18f37', //vbETH
  '0x9A6bd7B6Fd5C4F87eb66356441502fc7dCdd185B', //vbUSDT
  '0x93Fec6639717b6215A48E5a72a162C50DCC40d68' //AUSD
].map((addr) => addr.toLowerCase())

export const PENDLE_MARKET_VAULT_ADDRESSES = [
  '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8' // yBOLD
].map((addr) => addr.toLowerCase())

export const VAULT_ADDRESSES = {
  PENDLE_ARB_REWARDS: '0x1Dd930ADD968ff5913C3627dAA1e6e6FCC9dc544',
  KELP_N_ENGENLAYER: '0xDDa02A2FA0bb0ee45Ba9179a3fd7e65E5D3B2C90',
  KELP: '0x1Dd930ADD968ff5913C3627dAA1e6e6FCC9dc544',
  AUSD: '0x93fec6639717b6215a48e5a72a162c50dcc40d68'
}
