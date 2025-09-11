import type { TAddress } from '../types/address'
import { ZERO_ADDRESS } from './constants'
import { toAddress } from './tools.address'
import { isEthAddress, isTAddress } from './tools.is'

export function assert(
  expression: unknown,
  message?: string | Error,
  doSomething?: (error: unknown) => void
): asserts expression {
  if (!expression) {
    const error = message instanceof Error ? message : new Error(message || 'Assertion failed')
    doSomething?.(error)
    throw error
  }
}

export function assertAddress(addr: string | TAddress | undefined, name?: string): asserts addr is TAddress {
  assert(addr, `${name || 'Address'} is not set`)
  assert(isTAddress(addr), `${name || 'Address'} provided is invalid`)
  assert(toAddress(addr) !== ZERO_ADDRESS, `${name || 'Address'} is 0x0`)
  assert(!isEthAddress(addr), `${name || 'Address'} is 0xE`)
}
