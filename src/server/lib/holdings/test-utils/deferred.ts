export type TDeferred<TValue> = Readonly<{
  promise: Promise<TValue>
  resolve: (value: TValue | PromiseLike<TValue>) => void
  reject: (reason?: unknown) => void
}>

export function createDeferred<TValue>(): TDeferred<TValue> {
  const controls: {
    resolve: (value: TValue | PromiseLike<TValue>) => void
    reject: (reason?: unknown) => void
  } = {
    resolve: () => undefined,
    reject: () => undefined
  }
  const promise = new Promise<TValue>((resolve, reject) => {
    controls.resolve = resolve
    controls.reject = reject
  })

  return {
    promise,
    resolve: (value) => controls.resolve(value),
    reject: (reason) => controls.reject(reason)
  }
}
