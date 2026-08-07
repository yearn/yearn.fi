import { Buffer } from 'node:buffer'
import { getAddress } from 'viem'
import { holdingsConfig } from '@/server/lib/holdings/config'
import { stringifyCanonicalLedgerValue } from '@/server/lib/holdings/services/ledger/codec'
import { compareLedgerOrder } from '@/server/lib/holdings/services/ledger/order'
import {
  LEDGER_MAX_ACTIVE_REVISION_DECODED_BYTES,
  LEDGER_STREAMS,
  type TLedgerSixStreams,
  type TLedgerStream,
  type TLedgerTransferSourceEvent,
  type TLedgerV2DepositSourceEvent,
  type TLedgerV2WithdrawalSourceEvent,
  type TLedgerV3DepositSourceEvent,
  type TLedgerV3WithdrawalSourceEvent
} from '@/server/lib/holdings/services/ledger/types'
import { SUPPORTED_CHAINS } from '@/server/lib/holdings/types'

export const ENVIO_LEDGER_PAGE_SIZE = 1_000
export const ENVIO_LEDGER_MAX_PAGES_PER_STREAM_CHAIN = 1_000
export const ENVIO_LEDGER_MAX_FETCHED_ROWS = 250_000
export const ENVIO_LEDGER_MAX_FETCHED_DECODED_BYTES = 2 * LEDGER_MAX_ACTIVE_REVISION_DECODED_BYTES
export const ENVIO_LEDGER_MAX_RESPONSE_BYTES = 8 * 1024 * 1024

const ENVIO_LEDGER_REQUEST_TIMEOUT_MS = 30_000

const ENVIO_META_QUERY = `
  query LedgerIndexerMeta {
    _meta {
      chainId
      progressBlock
      eventsProcessed
      bufferBlock
      firstEventBlock
      sourceBlock
      readyAt
      isReady
      startBlock
      endBlock
    }
  }
`

const SUPPORTED_CHAIN_IDS = new Set(SUPPORTED_CHAINS.map(({ id }) => id))

type TEnvioJsonRecord = Record<string, unknown>

type TEnvioLedgerEventByStream = {
  readonly v3Deposits: TLedgerV3DepositSourceEvent
  readonly v3Withdrawals: TLedgerV3WithdrawalSourceEvent
  readonly v2Deposits: TLedgerV2DepositSourceEvent
  readonly v2Withdrawals: TLedgerV2WithdrawalSourceEvent
  readonly transfersIn: TLedgerTransferSourceEvent
  readonly transfersOut: TLedgerTransferSourceEvent
}

type TEnvioLedgerCursor = Readonly<{
  blockTimestamp: number
  blockNumber: number
  logIndex: number
  id: string
}>

interface TEnvioLedgerStreamSpec<TStream extends TLedgerStream> {
  readonly stream: TStream
  readonly operationName: string
  readonly entity: 'Deposit' | 'Withdraw' | 'V2Deposit' | 'V2Withdraw' | 'Transfer'
  readonly addressField: 'owner' | 'recipient' | 'receiver' | 'sender'
  readonly selection: string
  readonly parseEvent: (value: unknown) => TEnvioLedgerEventByStream[TStream]
}

export interface TEnvioLedgerMetadata {
  readonly chainId: number
  readonly progressBlock: number
  readonly eventsProcessed: number
  readonly bufferBlock: number | null
  readonly firstEventBlock: number | null
  readonly sourceBlock: number | null
  readonly readyAt: string | null
  readonly isReady: boolean
  readonly startBlock: number
  readonly endBlock: number | null
}

export interface TEnvioLedgerChainWindow {
  readonly chainId: number
  readonly lowerBlock: number
  readonly upperBlock: number
}

export type TEnvioLedgerLowerBlocks = Readonly<Partial<Record<number, number>>>

export interface TEnvioLedgerStreamStats {
  readonly pages: number
  readonly rows: number
}

export interface TEnvioLedgerFetchStats {
  readonly byStream: Readonly<Record<TLedgerStream, TEnvioLedgerStreamStats>>
  readonly totalPages: number
  readonly totalRows: number
  readonly chainCount: number
  readonly validationQueries: number
}

export interface TEnvioLedgerStreamsResult {
  readonly streams: TLedgerSixStreams
  readonly stats: TEnvioLedgerFetchStats
}

export interface TFetchEnvioLedgerStreamsOptions {
  readonly onPage?: () => Promise<void>
  readonly budgetLimits?: Readonly<{
    readonly maximumRows?: number
    readonly maximumDecodedBytes?: number
  }>
}

export interface TEnvioLedgerSourceResult extends TEnvioLedgerStreamsResult {
  readonly metadata: readonly TEnvioLedgerMetadata[]
  readonly windows: readonly TEnvioLedgerChainWindow[]
}

export interface TFetchEnvioLedgerSourceInput {
  readonly address: string
  readonly metadata?: readonly TEnvioLedgerMetadata[]
  readonly lowerBlockByChain?: TEnvioLedgerLowerBlocks
  readonly onPage?: () => Promise<void>
}

interface TEnvioLedgerFetchBudget {
  rows: number
  decodedBytes: number
  readonly maximumRows: number
  readonly maximumDecodedBytes: number
}

function isRecord(value: unknown): value is TEnvioJsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function getFetchBudgetLimit(value: number | undefined, maximum: number): number {
  if (value === undefined) {
    return maximum
  }
  if (!isNonNegativeSafeInteger(value) || value > maximum) {
    throw new Error('Envio ledger source fetch budget is invalid')
  }
  return value
}

function createFetchBudget(limits: TFetchEnvioLedgerStreamsOptions['budgetLimits']): TEnvioLedgerFetchBudget {
  return {
    rows: 0,
    decodedBytes: 0,
    maximumRows: getFetchBudgetLimit(limits?.maximumRows, ENVIO_LEDGER_MAX_FETCHED_ROWS),
    maximumDecodedBytes: getFetchBudgetLimit(limits?.maximumDecodedBytes, ENVIO_LEDGER_MAX_FETCHED_DECODED_BYTES)
  }
}

function consumeFetchBudget(
  budget: TEnvioLedgerFetchBudget,
  events: readonly TEnvioLedgerEventByStream[TLedgerStream][]
): void {
  const rows = budget.rows + events.length
  if (rows > budget.maximumRows) {
    throw new Error('Envio ledger source fetch budget exceeded')
  }
  const pageBytes = events.length === 0 ? 0 : Buffer.byteLength(stringifyCanonicalLedgerValue(events), 'utf8')
  const decodedBytes = budget.decodedBytes + pageBytes
  if (decodedBytes > budget.maximumDecodedBytes) {
    throw new Error('Envio ledger source fetch budget exceeded')
  }
  budget.rows = rows
  budget.decodedBytes = decodedBytes
}

function readRequiredString(record: TEnvioJsonRecord, field: string): string {
  const value = record[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Envio ledger source response is invalid')
  }
  return value
}

function readRequiredInteger(record: TEnvioJsonRecord, field: string): number {
  const value = record[field]
  if (!isNonNegativeSafeInteger(value)) {
    throw new Error('Envio ledger source response is invalid')
  }
  return value
}

function readNullableInteger(record: TEnvioJsonRecord, field: string): number | null {
  const value = record[field]
  if (value !== null && !isNonNegativeSafeInteger(value)) {
    throw new Error('Envio ledger source metadata is invalid')
  }
  return value
}

function parseBaseEvent(value: unknown): {
  id: string
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  logIndex: number
  transactionHash: string
  transactionFrom: string
} {
  if (!isRecord(value)) {
    throw new Error('Envio ledger source response is invalid')
  }
  return {
    id: readRequiredString(value, 'id'),
    vaultAddress: readRequiredString(value, 'vaultAddress'),
    chainId: readRequiredInteger(value, 'chainId'),
    blockNumber: readRequiredInteger(value, 'blockNumber'),
    blockTimestamp: readRequiredInteger(value, 'blockTimestamp'),
    logIndex: readRequiredInteger(value, 'logIndex'),
    transactionHash: readRequiredString(value, 'transactionHash'),
    transactionFrom: readRequiredString(value, 'transactionFrom')
  }
}

function parseV3Deposit(value: unknown): TLedgerV3DepositSourceEvent {
  if (!isRecord(value)) {
    throw new Error('Envio ledger source response is invalid')
  }
  return {
    ...parseBaseEvent(value),
    owner: readRequiredString(value, 'owner'),
    sender: readRequiredString(value, 'sender'),
    assets: readRequiredString(value, 'assets'),
    shares: readRequiredString(value, 'shares')
  }
}

function parseV3Withdrawal(value: unknown): TLedgerV3WithdrawalSourceEvent {
  if (!isRecord(value)) {
    throw new Error('Envio ledger source response is invalid')
  }
  return {
    ...parseBaseEvent(value),
    owner: readRequiredString(value, 'owner'),
    assets: readRequiredString(value, 'assets'),
    shares: readRequiredString(value, 'shares')
  }
}

function parseV2Deposit(value: unknown): TLedgerV2DepositSourceEvent {
  if (!isRecord(value)) {
    throw new Error('Envio ledger source response is invalid')
  }
  return {
    ...parseBaseEvent(value),
    recipient: readRequiredString(value, 'recipient'),
    amount: readRequiredString(value, 'amount'),
    shares: readRequiredString(value, 'shares')
  }
}

function parseV2Withdrawal(value: unknown): TLedgerV2WithdrawalSourceEvent {
  if (!isRecord(value)) {
    throw new Error('Envio ledger source response is invalid')
  }
  return {
    ...parseBaseEvent(value),
    recipient: readRequiredString(value, 'recipient'),
    amount: readRequiredString(value, 'amount'),
    shares: readRequiredString(value, 'shares')
  }
}

function parseTransfer(value: unknown): TLedgerTransferSourceEvent {
  if (!isRecord(value)) {
    throw new Error('Envio ledger source response is invalid')
  }
  return {
    ...parseBaseEvent(value),
    sender: readRequiredString(value, 'sender'),
    receiver: readRequiredString(value, 'receiver'),
    value: readRequiredString(value, 'value')
  }
}

const V3_DEPOSITS_SPEC: TEnvioLedgerStreamSpec<'v3Deposits'> = {
  stream: 'v3Deposits',
  operationName: 'LedgerV3Deposits',
  entity: 'Deposit',
  addressField: 'owner',
  selection: `
    id
    vaultAddress
    chainId
    blockNumber
    blockTimestamp
    logIndex
    transactionHash
    transactionFrom
    owner
    sender
    assets
    shares
  `,
  parseEvent: parseV3Deposit
}

const V3_WITHDRAWALS_SPEC: TEnvioLedgerStreamSpec<'v3Withdrawals'> = {
  stream: 'v3Withdrawals',
  operationName: 'LedgerV3Withdrawals',
  entity: 'Withdraw',
  addressField: 'owner',
  selection: `
    id
    vaultAddress
    chainId
    blockNumber
    blockTimestamp
    logIndex
    transactionHash
    transactionFrom
    owner
    assets
    shares
  `,
  parseEvent: parseV3Withdrawal
}

const V2_DEPOSITS_SPEC: TEnvioLedgerStreamSpec<'v2Deposits'> = {
  stream: 'v2Deposits',
  operationName: 'LedgerV2Deposits',
  entity: 'V2Deposit',
  addressField: 'recipient',
  selection: `
    id
    vaultAddress
    chainId
    blockNumber
    blockTimestamp
    logIndex
    transactionHash
    transactionFrom
    recipient
    amount
    shares
  `,
  parseEvent: parseV2Deposit
}

const V2_WITHDRAWALS_SPEC: TEnvioLedgerStreamSpec<'v2Withdrawals'> = {
  stream: 'v2Withdrawals',
  operationName: 'LedgerV2Withdrawals',
  entity: 'V2Withdraw',
  addressField: 'recipient',
  selection: `
    id
    vaultAddress
    chainId
    blockNumber
    blockTimestamp
    logIndex
    transactionHash
    transactionFrom
    recipient
    amount
    shares
  `,
  parseEvent: parseV2Withdrawal
}

const TRANSFERS_IN_SPEC: TEnvioLedgerStreamSpec<'transfersIn'> = {
  stream: 'transfersIn',
  operationName: 'LedgerTransfersIn',
  entity: 'Transfer',
  addressField: 'receiver',
  selection: `
    id
    vaultAddress
    chainId
    blockNumber
    blockTimestamp
    logIndex
    transactionHash
    transactionFrom
    sender
    receiver
    value
  `,
  parseEvent: parseTransfer
}

const TRANSFERS_OUT_SPEC: TEnvioLedgerStreamSpec<'transfersOut'> = {
  stream: 'transfersOut',
  operationName: 'LedgerTransfersOut',
  entity: 'Transfer',
  addressField: 'sender',
  selection: TRANSFERS_IN_SPEC.selection,
  parseEvent: parseTransfer
}

function createFirstPageQuery<TStream extends TLedgerStream>(spec: TEnvioLedgerStreamSpec<TStream>): string {
  return `
    query ${spec.operationName}FirstPage(
      $${spec.addressField}: String!
      $chainId: Int!
      $lowerBlock: Int!
      $upperBlock: Int!
      $limit: Int!
    ) {
      ${spec.entity}(
        where: {
          ${spec.addressField}: { _eq: $${spec.addressField} }
          chainId: { _eq: $chainId }
          blockNumber: { _gte: $lowerBlock, _lte: $upperBlock }
        }
        order_by: [
          { blockTimestamp: asc }
          { blockNumber: asc }
          { logIndex: asc }
          { id: asc }
        ]
        limit: $limit
      ) {
        ${spec.selection}
      }
    }
  `
}

function createNextPageQuery<TStream extends TLedgerStream>(spec: TEnvioLedgerStreamSpec<TStream>): string {
  return `
    query ${spec.operationName}NextPage(
      $${spec.addressField}: String!
      $chainId: Int!
      $lowerBlock: Int!
      $upperBlock: Int!
      $cursorTimestamp: Int!
      $cursorBlock: Int!
      $cursorLogIndex: Int!
      $cursorId: String!
      $limit: Int!
    ) {
      ${spec.entity}(
        where: {
          ${spec.addressField}: { _eq: $${spec.addressField} }
          chainId: { _eq: $chainId }
          blockNumber: { _gte: $lowerBlock, _lte: $upperBlock }
          _or: [
            { blockTimestamp: { _gt: $cursorTimestamp } }
            {
              blockTimestamp: { _eq: $cursorTimestamp }
              blockNumber: { _gt: $cursorBlock }
            }
            {
              blockTimestamp: { _eq: $cursorTimestamp }
              blockNumber: { _eq: $cursorBlock }
              logIndex: { _gt: $cursorLogIndex }
            }
            {
              blockTimestamp: { _eq: $cursorTimestamp }
              blockNumber: { _eq: $cursorBlock }
              logIndex: { _eq: $cursorLogIndex }
              id: { _gt: $cursorId }
            }
          ]
        }
        order_by: [
          { blockTimestamp: asc }
          { blockNumber: asc }
          { logIndex: asc }
          { id: asc }
        ]
        limit: $limit
      ) {
        ${spec.selection}
      }
    }
  `
}

async function readBoundedResponseBody(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > ENVIO_LEDGER_MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error('Envio ledger source response is invalid')
  }
  if (!response.body) {
    return ''
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  const state = { totalBytes: 0, completed: false }
  const readNextChunk = async (): Promise<void> => {
    const result = await reader.read()
    if (result.done) {
      state.completed = true
      return
    }
    state.totalBytes += result.value.byteLength
    if (state.totalBytes > ENVIO_LEDGER_MAX_RESPONSE_BYTES) {
      throw new Error('Envio ledger source response is invalid')
    }
    chunks.push(decoder.decode(result.value, { stream: true }))
    return readNextChunk()
  }
  try {
    await readNextChunk()
    chunks.push(decoder.decode())
    return chunks.join('')
  } finally {
    if (!state.completed) {
      await reader.cancel().catch(() => undefined)
    }
    reader.releaseLock()
  }
}

async function parseJsonResponse(response: Response): Promise<TEnvioJsonRecord> {
  try {
    const body = await readBoundedResponseBody(response)
    const payload: unknown = JSON.parse(body)
    if (!isRecord(payload)) {
      throw new Error('Envio ledger source response is invalid')
    }
    return payload
  } catch {
    throw new Error('Envio ledger source response is invalid')
  }
}

async function executeEnvioQuery(
  query: string,
  variables: Readonly<Record<string, unknown>>
): Promise<TEnvioJsonRecord> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const password = holdingsConfig.envioPassword
  if (password && password !== 'testing') {
    headers['x-hasura-admin-secret'] = password
  }

  const response = await fetch(holdingsConfig.envioGraphqlUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(ENVIO_LEDGER_REQUEST_TIMEOUT_MS)
  }).catch(() => {
    throw new Error('Envio ledger source request failed')
  })

  if (!response.ok) {
    throw new Error('Envio ledger source request was unsuccessful')
  }

  const payload = await parseJsonResponse(response)
  if (payload.errors !== undefined && payload.errors !== null) {
    throw new Error('Envio ledger source request returned GraphQL errors')
  }
  if (!isRecord(payload.data)) {
    throw new Error('Envio ledger source response is invalid')
  }
  return payload.data
}

function parseMetadataRow(value: unknown): TEnvioLedgerMetadata {
  if (!isRecord(value)) {
    throw new Error('Envio ledger source metadata is invalid')
  }
  const chainId = readRequiredInteger(value, 'chainId')
  const progressBlock = readRequiredInteger(value, 'progressBlock')
  const eventsProcessed = readRequiredInteger(value, 'eventsProcessed')
  const startBlock = readRequiredInteger(value, 'startBlock')
  const readyAt = value.readyAt
  const isReady = value.isReady

  if ((readyAt !== null && typeof readyAt !== 'string') || typeof isReady !== 'boolean' || startBlock > progressBlock) {
    throw new Error('Envio ledger source metadata is invalid')
  }

  return {
    chainId,
    progressBlock,
    eventsProcessed,
    bufferBlock: readNullableInteger(value, 'bufferBlock'),
    firstEventBlock: readNullableInteger(value, 'firstEventBlock'),
    sourceBlock: readNullableInteger(value, 'sourceBlock'),
    readyAt,
    isReady,
    startBlock,
    endBlock: readNullableInteger(value, 'endBlock')
  }
}

function parseSupportedMetadata(value: unknown): readonly TEnvioLedgerMetadata[] {
  if (!Array.isArray(value)) {
    throw new Error('Envio ledger source metadata is invalid')
  }
  const metadata = value.map(parseMetadataRow)
  const chainIds = metadata.map(({ chainId }) => chainId)
  if (new Set(chainIds).size !== chainIds.length) {
    throw new Error('Envio ledger source metadata is invalid')
  }
  return metadata
    .filter(({ chainId }) => SUPPORTED_CHAIN_IDS.has(chainId))
    .sort((left, right) => left.chainId - right.chainId)
}

export async function fetchEnvioLedgerMetadata(): Promise<readonly TEnvioLedgerMetadata[]> {
  const data = await executeEnvioQuery(ENVIO_META_QUERY, {})
  return parseSupportedMetadata(data._meta)
}

export async function rereadEnvioLedgerMetadata(
  expected: readonly TEnvioLedgerMetadata[]
): Promise<readonly TEnvioLedgerMetadata[]> {
  const validatedExpected = parseSupportedMetadata(expected)
  const expectedChainIds = new Set(validatedExpected.map(({ chainId }) => chainId))
  const current = (await fetchEnvioLedgerMetadata()).filter(({ chainId }) => expectedChainIds.has(chainId))
  const currentByChain = new Map(current.map((metadata) => [metadata.chainId, metadata]))
  const changed =
    current.length !== validatedExpected.length ||
    validatedExpected.some((metadata) => {
      const candidate = currentByChain.get(metadata.chainId)
      return (
        candidate === undefined ||
        candidate.progressBlock < metadata.progressBlock ||
        candidate.eventsProcessed < metadata.eventsProcessed ||
        candidate.startBlock !== metadata.startBlock ||
        candidate.endBlock !== metadata.endBlock
      )
    })

  if (changed) {
    throw new Error('Envio ledger source metadata changed during synchronization')
  }
  return current
}

export function createEnvioLedgerChainWindows(
  metadata: readonly TEnvioLedgerMetadata[],
  lowerBlockByChain: TEnvioLedgerLowerBlocks = {}
): readonly TEnvioLedgerChainWindow[] {
  return parseSupportedMetadata(metadata).map((entry) => {
    const requestedLowerBlock = lowerBlockByChain[entry.chainId] ?? entry.startBlock
    if (!isNonNegativeSafeInteger(requestedLowerBlock)) {
      throw new Error('Envio ledger source block window is invalid')
    }
    const lowerBlock = Math.max(entry.startBlock, requestedLowerBlock)
    if (lowerBlock > entry.progressBlock) {
      throw new Error('Envio ledger source block window is invalid')
    }
    return {
      chainId: entry.chainId,
      lowerBlock,
      upperBlock: entry.progressBlock
    }
  })
}

function validateWindows(windows: readonly TEnvioLedgerChainWindow[]): readonly TEnvioLedgerChainWindow[] {
  const valid = windows.every(
    ({ chainId, lowerBlock, upperBlock }) =>
      SUPPORTED_CHAIN_IDS.has(chainId) &&
      isNonNegativeSafeInteger(chainId) &&
      isNonNegativeSafeInteger(lowerBlock) &&
      isNonNegativeSafeInteger(upperBlock) &&
      lowerBlock <= upperBlock
  )
  const chainIds = windows.map(({ chainId }) => chainId)
  if (!valid || new Set(chainIds).size !== chainIds.length) {
    throw new Error('Envio ledger source block window is invalid')
  }
  return [...windows].sort((left, right) => left.chainId - right.chainId)
}

function normalizeAddress(address: string): string {
  try {
    return getAddress(address)
  } catch {
    throw new Error('Envio ledger source address is invalid')
  }
}

function compareCursors(left: TEnvioLedgerCursor, right: TEnvioLedgerCursor): number {
  return compareLedgerOrder(left, right)
}

function getCursor(event: TEnvioLedgerEventByStream[TLedgerStream]): TEnvioLedgerCursor {
  return {
    blockTimestamp: event.blockTimestamp,
    blockNumber: event.blockNumber,
    logIndex: event.logIndex,
    id: event.id
  }
}

function validatePage<TStream extends TLedgerStream>(
  spec: TEnvioLedgerStreamSpec<TStream>,
  value: unknown,
  window: TEnvioLedgerChainWindow,
  previousCursor: TEnvioLedgerCursor | null,
  address: string
): readonly TEnvioLedgerEventByStream[TStream][] {
  if (!Array.isArray(value) || value.length > ENVIO_LEDGER_PAGE_SIZE) {
    throw new Error('Envio ledger source page is invalid')
  }
  const events = value.map(spec.parseEvent)
  const rowsMatchWindow = events.every(
    ({ chainId, blockNumber }) =>
      chainId === window.chainId && blockNumber >= window.lowerBlock && blockNumber <= window.upperBlock
  )
  const rowsMatchAddress = events.every((event) => {
    const eventAddress = Reflect.get(event, spec.addressField)
    return typeof eventAddress === 'string' && eventAddress.toLowerCase() === address.toLowerCase()
  })
  const cursors = events.map(getCursor)
  const priorCursors = [previousCursor, ...cursors.slice(0, -1)]
  const strictlyIncreasing = cursors.every((cursor, index) => {
    const prior = priorCursors[index]
    return prior === null || prior === undefined || compareCursors(prior, cursor) < 0
  })

  if (!rowsMatchWindow || !rowsMatchAddress || !strictlyIncreasing) {
    throw new Error('Envio ledger source page did not advance')
  }
  return events
}

async function fetchStreamPages<TStream extends TLedgerStream>(
  spec: TEnvioLedgerStreamSpec<TStream>,
  address: string,
  window: TEnvioLedgerChainWindow,
  budget: TEnvioLedgerFetchBudget,
  onPage?: () => Promise<void>
): Promise<{ readonly events: readonly TEnvioLedgerEventByStream[TStream][]; readonly pages: number }> {
  const state = {
    events: [] as TEnvioLedgerEventByStream[TStream][],
    cursor: null as TEnvioLedgerCursor | null,
    pages: 0
  }
  const fetchNextPage = async (): Promise<{
    readonly events: readonly TEnvioLedgerEventByStream[TStream][]
    readonly pages: number
  }> => {
    if (state.pages >= ENVIO_LEDGER_MAX_PAGES_PER_STREAM_CHAIN) {
      throw new Error('Envio ledger source page limit exceeded')
    }
    const query = state.cursor === null ? createFirstPageQuery(spec) : createNextPageQuery(spec)
    const variables: Record<string, unknown> = {
      [spec.addressField]: address,
      chainId: window.chainId,
      lowerBlock: window.lowerBlock,
      upperBlock: window.upperBlock,
      limit: ENVIO_LEDGER_PAGE_SIZE
    }
    if (state.cursor !== null) {
      variables.cursorTimestamp = state.cursor.blockTimestamp
      variables.cursorBlock = state.cursor.blockNumber
      variables.cursorLogIndex = state.cursor.logIndex
      variables.cursorId = state.cursor.id
    }

    const data = await executeEnvioQuery(query, variables)
    const events = validatePage(spec, data[spec.entity], window, state.cursor, address)
    consumeFetchBudget(budget, events)
    state.events.push(...events)
    state.pages += 1
    await onPage?.()
    if (events.length < ENVIO_LEDGER_PAGE_SIZE) {
      return { events: state.events, pages: state.pages }
    }

    const nextCursor = events.at(-1)
    if (!nextCursor) {
      throw new Error('Envio ledger source page did not advance')
    }
    state.cursor = getCursor(nextCursor)
    return fetchNextPage()
  }
  return fetchNextPage()
}

async function fetchStream<TStream extends TLedgerStream>(
  spec: TEnvioLedgerStreamSpec<TStream>,
  address: string,
  windows: readonly TEnvioLedgerChainWindow[],
  budget: TEnvioLedgerFetchBudget,
  onPage?: () => Promise<void>
): Promise<{
  readonly events: readonly TEnvioLedgerEventByStream[TStream][]
  readonly stats: TEnvioLedgerStreamStats
}> {
  const results = await windows.reduce<
    Promise<Array<{ readonly events: readonly TEnvioLedgerEventByStream[TStream][]; readonly pages: number }>>
  >(async (pendingResults, window) => {
    const resolvedResults = await pendingResults
    const result = await fetchStreamPages(spec, address, window, budget, onPage)
    return [...resolvedResults, result]
  }, Promise.resolve([]))
  const events = results.flatMap((result) => result.events)
  return {
    events,
    stats: {
      pages: results.reduce((total, result) => total + result.pages, 0),
      rows: events.length
    }
  }
}

function assertSelfTransferSymmetry(
  address: string,
  transfersIn: readonly TLedgerTransferSourceEvent[],
  transfersOut: readonly TLedgerTransferSourceEvent[]
): void {
  const getSelfTransfers = (events: readonly TLedgerTransferSourceEvent[]) =>
    events
      .filter(({ sender, receiver }) => sender.toLowerCase() === address && receiver.toLowerCase() === address)
      .reduce((byIdentity, event) => {
        const identity = stringifyCanonicalLedgerValue([event.chainId, event.id])
        const encoded = stringifyCanonicalLedgerValue(event)
        if (byIdentity.has(identity) && byIdentity.get(identity) !== encoded) {
          throw new Error('Envio ledger source self-transfer streams are inconsistent')
        }
        byIdentity.set(identity, encoded)
        return byIdentity
      }, new Map<string, string>())
  const inbound = getSelfTransfers(transfersIn)
  const outbound = getSelfTransfers(transfersOut)
  const inconsistent =
    inbound.size !== outbound.size ||
    Array.from(inbound.entries()).some(([identity, encoded]) => outbound.get(identity) !== encoded)
  if (inconsistent) {
    throw new Error('Envio ledger source self-transfer streams are inconsistent')
  }
}

export async function fetchEnvioLedgerStreams(
  address: string,
  windows: readonly TEnvioLedgerChainWindow[],
  options: TFetchEnvioLedgerStreamsOptions = {}
): Promise<TEnvioLedgerStreamsResult> {
  const normalizedAddress = normalizeAddress(address)
  const validatedWindows = validateWindows(windows)
  const budget = createFetchBudget(options.budgetLimits)
  const v3Deposits = await fetchStream(V3_DEPOSITS_SPEC, normalizedAddress, validatedWindows, budget, options.onPage)
  const v3Withdrawals = await fetchStream(
    V3_WITHDRAWALS_SPEC,
    normalizedAddress,
    validatedWindows,
    budget,
    options.onPage
  )
  const v2Deposits = await fetchStream(V2_DEPOSITS_SPEC, normalizedAddress, validatedWindows, budget, options.onPage)
  const v2Withdrawals = await fetchStream(
    V2_WITHDRAWALS_SPEC,
    normalizedAddress,
    validatedWindows,
    budget,
    options.onPage
  )
  const transfersIn = await fetchStream(TRANSFERS_IN_SPEC, normalizedAddress, validatedWindows, budget, options.onPage)
  const transfersOut = await fetchStream(
    TRANSFERS_OUT_SPEC,
    normalizedAddress,
    validatedWindows,
    budget,
    options.onPage
  )
  assertSelfTransferSymmetry(normalizedAddress.toLowerCase(), transfersIn.events, transfersOut.events)
  const streams: TLedgerSixStreams = {
    v3Deposits: v3Deposits.events,
    v3Withdrawals: v3Withdrawals.events,
    v2Deposits: v2Deposits.events,
    v2Withdrawals: v2Withdrawals.events,
    transfersIn: transfersIn.events,
    transfersOut: transfersOut.events
  }
  const byStream: Readonly<Record<TLedgerStream, TEnvioLedgerStreamStats>> = {
    v3Deposits: v3Deposits.stats,
    v3Withdrawals: v3Withdrawals.stats,
    v2Deposits: v2Deposits.stats,
    v2Withdrawals: v2Withdrawals.stats,
    transfersIn: transfersIn.stats,
    transfersOut: transfersOut.stats
  }
  const totalPages = LEDGER_STREAMS.reduce((total, stream) => total + byStream[stream].pages, 0)
  const totalRows = LEDGER_STREAMS.reduce((total, stream) => total + byStream[stream].rows, 0)

  return {
    streams,
    stats: {
      byStream,
      totalPages,
      totalRows,
      chainCount: validatedWindows.length,
      validationQueries: 0
    }
  }
}

export async function fetchEnvioLedgerSource({
  address,
  metadata,
  lowerBlockByChain,
  onPage
}: TFetchEnvioLedgerSourceInput): Promise<TEnvioLedgerSourceResult> {
  const resolvedMetadata = metadata ? parseSupportedMetadata(metadata) : await fetchEnvioLedgerMetadata()
  const windows = createEnvioLedgerChainWindows(resolvedMetadata, lowerBlockByChain)
  const result = await fetchEnvioLedgerStreams(address, windows, { onPage })
  return {
    metadata: resolvedMetadata,
    windows,
    ...result
  }
}
