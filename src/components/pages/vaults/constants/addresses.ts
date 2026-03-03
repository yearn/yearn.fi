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

/**************************************************************************************************
 ** Vault addresses eligible for Yield Splitter on Katana chain
 *************************************************************************************************/
export const SPLITTER_VAULT_ADDRESSES = [
  '0xE007CA01894c863d7898045ed5A3B4Abf0b18f37', // yvvbETH
  '0x80c34BD3A3569E126e7055831036aa7b212cB159', // yvvbUSDC
  '0xAa0362eCC584B985056E47812931270b99C91f9d' // yvvbWBTC
].map((addr) => addr.toLowerCase())

export const SPLITTER_ROUTES = [
  {
    vault: '0xe007ca01894c863d7898045ed5a3b4abf0b18f37',
    strategy: '0xA03e39CDeAC8c2823A6EDC80956207294807c20d',
    want: '0x80c34bd3a3569e126e7055831036aa7b212cb159'
  },
  {
    vault: '0xaa0362ecc584b985056e47812931270b99c91f9d',
    strategy: '0x2f817617A682A18851E3EaCBD945b214BE70474E',
    want: '0x80c34bd3a3569e126e7055831036aa7b212cb159'
  },
  {
    vault: '0x80c34bd3a3569e126e7055831036aa7b212cb159',
    strategy: '0xF352cdbE225B82Cc458aCa3c127F2935d7EE12CB',
    want: '0xe007ca01894c863d7898045ed5a3b4abf0b18f37'
  },
  {
    vault: '0x80c34bd3a3569e126e7055831036aa7b212cb159',
    strategy: '0x1166da048a9B0E840A57dD9Dce5378e6c32E53C4',
    want: '0xaa0362ecc584b985056e47812931270b99c91f9d'
  },
  {
    vault: '0xe007ca01894c863d7898045ed5a3b4abf0b18f37',
    strategy: '0x17E6ee30d939d1C0186EF98265e9a4E38A056AA1',
    want: '0xaa0362ecc584b985056e47812931270b99c91f9d'
  },
  {
    vault: '0xaa0362ecc584b985056e47812931270b99c91f9d',
    strategy: '0x518EA05c41F89e36985A94c6dF8782F6d3F45111',
    want: '0xe007ca01894c863d7898045ed5a3b4abf0b18f37'
  }
] as const

export const isSplitterVault = (address: string): boolean => SPLITTER_VAULT_ADDRESSES.includes(address.toLowerCase())

export const getSplitterRoutesForVault = (vaultAddress: string) =>
  SPLITTER_ROUTES.filter((r) => r.vault === vaultAddress.toLowerCase())

export const getSplitterStrategyAddress = (vaultAddress: string, wantAddress: string): string | undefined =>
  SPLITTER_ROUTES.find((r) => r.vault === vaultAddress.toLowerCase() && r.want === wantAddress.toLowerCase())?.strategy

export const VAULT_ADDRESSES = {
  PENDLE_ARB_REWARDS: '0x1Dd930ADD968ff5913C3627dAA1e6e6FCC9dc544',
  KELP_N_ENGENLAYER: '0xDDa02A2FA0bb0ee45Ba9179a3fd7e65E5D3B2C90',
  KELP: '0x1Dd930ADD968ff5913C3627dAA1e6e6FCC9dc544',
  AUSD: '0x93fec6639717b6215a48e5a72a162c50dcc40d68'
}
