// lodash dupe for chaining, chunking, etc.

type ChainableValue<T> = {
  value: () => T
  chunk: (size: number) => ChainableValue<T[]>
  map: <U>(fn: (item: T extends (infer U)[] ? U : T, index?: number) => U) => ChainableValue<U[]>
  filter: (fn: (item: T extends (infer U)[] ? U : T, index?: number) => boolean) => ChainableValue<T>
  reduce: <U>(fn: (acc: U, item: T extends (infer U)[] ? U : T, index?: number) => U, initial: U) => ChainableValue<U>
  flatten: () => ChainableValue<T extends (infer U)[][] ? U[] : T>
  compact: () => ChainableValue<T>
  uniq: () => ChainableValue<T>
  sortBy: <K extends keyof (T extends (infer U)[] ? U : T)>(key: K) => ChainableValue<T>
  groupBy: <K extends keyof (T extends (infer U)[] ? U : T)>(key: K) => ChainableValue<Record<string, T[]>>
  take: (n: number) => ChainableValue<T>
  drop: (n: number) => ChainableValue<T>
  reverse: () => ChainableValue<T>
}

class Chain<T> implements ChainableValue<T> {
  constructor(private data: T) {}

  value(): T {
    return this.data
  }

  chunk(size: number): ChainableValue<any> {
    if (!Array.isArray(this.data)) {
      throw new Error('chunk can only be called on arrays')
    }
    const result: any[] = []
    for (let i = 0; i < this.data.length; i += size) {
      result.push(this.data.slice(i, i + size))
    }
    return new Chain(result)
  }

  map<U>(fn: (item: any, index?: number) => U): ChainableValue<U[]> {
    if (!Array.isArray(this.data)) {
      throw new Error('map can only be called on arrays')
    }
    return new Chain(this.data.map(fn))
  }

  filter(fn: (item: any, index?: number) => boolean): ChainableValue<T> {
    if (!Array.isArray(this.data)) {
      throw new Error('filter can only be called on arrays')
    }
    return new Chain(this.data.filter(fn) as T)
  }

  reduce<U>(fn: (acc: U, item: any, index?: number) => U, initial: U): ChainableValue<U> {
    if (!Array.isArray(this.data)) {
      throw new Error('reduce can only be called on arrays')
    }
    return new Chain(this.data.reduce(fn, initial))
  }

  flatten(): ChainableValue<any> {
    if (!Array.isArray(this.data)) {
      throw new Error('flatten can only be called on arrays')
    }
    const result = this.data.flat()
    return new Chain(result)
  }

  compact(): ChainableValue<T> {
    if (!Array.isArray(this.data)) {
      throw new Error('compact can only be called on arrays')
    }
    return new Chain(this.data.filter(Boolean) as T)
  }

  uniq(): ChainableValue<T> {
    if (!Array.isArray(this.data)) {
      throw new Error('uniq can only be called on arrays')
    }
    return new Chain([...new Set(this.data)] as T)
  }

  sortBy<K extends keyof any>(key: K): ChainableValue<T> {
    if (!Array.isArray(this.data)) {
      throw new Error('sortBy can only be called on arrays')
    }
    const sorted = [...this.data].sort((a: any, b: any) => {
      const aVal = a[key]
      const bVal = b[key]
      if (aVal < bVal) return -1
      if (aVal > bVal) return 1
      return 0
    })
    return new Chain(sorted as T)
  }

  groupBy<K extends keyof any>(key: K): ChainableValue<Record<string, any[]>> {
    if (!Array.isArray(this.data)) {
      throw new Error('groupBy can only be called on arrays')
    }
    const result: Record<string, any[]> = {}
    this.data.forEach((item: any) => {
      const groupKey = String(item[key])
      if (!result[groupKey]) {
        result[groupKey] = []
      }
      result[groupKey].push(item)
    })
    return new Chain(result)
  }

  take(n: number): ChainableValue<T> {
    if (!Array.isArray(this.data)) {
      throw new Error('take can only be called on arrays')
    }
    return new Chain(this.data.slice(0, n) as T)
  }

  drop(n: number): ChainableValue<T> {
    if (!Array.isArray(this.data)) {
      throw new Error('drop can only be called on arrays')
    }
    return new Chain(this.data.slice(n) as T)
  }

  reverse(): ChainableValue<T> {
    if (!Array.isArray(this.data)) {
      throw new Error('reverse can only be called on arrays')
    }
    return new Chain([...this.data].reverse() as T)
  }
}

const _ = {
  chain: <T>(data: T): ChainableValue<T> => new Chain(data),

  chunk: <T>(array: T[], size: number): T[][] => {
    const result: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size))
    }
    return result
  },

  map: <T, U>(array: T[], fn: (item: T, index?: number) => U): U[] => {
    return array.map(fn)
  },

  filter: <T>(array: T[], fn: (item: T, index?: number) => boolean): T[] => {
    return array.filter(fn)
  },

  reduce: <T, U>(array: T[], fn: (acc: U, item: T, index?: number) => U, initial: U): U => {
    return array.reduce(fn, initial)
  },

  flatten: <T>(array: T[][]): T[] => {
    return array.flat()
  },

  flattenDeep: <T>(array: any[]): T[] => {
    return array.flat(Infinity)
  },

  compact: <T>(array: (T | null | undefined | false | 0 | '')[]): T[] => {
    return array.filter(Boolean) as T[]
  },

  uniq: <T>(array: T[]): T[] => {
    return [...new Set(array)]
  },

  uniqBy: <T, K extends keyof T>(array: T[], key: K): T[] => {
    const seen = new Set()
    return array.filter((item) => {
      const val = item[key]
      if (seen.has(val)) return false
      seen.add(val)
      return true
    })
  },

  sortBy: <T, K extends keyof T>(array: T[], key: K): T[] => {
    return [...array].sort((a, b) => {
      const aVal = a[key]
      const bVal = b[key]
      if (aVal < bVal) return -1
      if (aVal > bVal) return 1
      return 0
    })
  },

  groupBy: <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
    return array.reduce(
      (acc, item) => {
        const groupKey = String(item[key])
        if (!acc[groupKey]) {
          acc[groupKey] = []
        }
        acc[groupKey].push(item)
        return acc
      },
      {} as Record<string, T[]>
    )
  },

  keyBy: <T, K extends keyof T>(array: T[], key: K): Record<string, T> => {
    return array.reduce(
      (acc, item) => {
        acc[String(item[key])] = item
        return acc
      },
      {} as Record<string, T>
    )
  },

  partition: <T>(array: T[], fn: (item: T, index?: number) => boolean): [T[], T[]] => {
    const truthy: T[] = []
    const falsy: T[] = []
    array.forEach((item, index) => {
      if (fn(item, index)) {
        truthy.push(item)
      } else {
        falsy.push(item)
      }
    })
    return [truthy, falsy]
  },

  take: <T>(array: T[], n: number): T[] => {
    return array.slice(0, n)
  },

  drop: <T>(array: T[], n: number): T[] => {
    return array.slice(n)
  },

  head: <T>(array: T[]): T | undefined => {
    return array[0]
  },

  last: <T>(array: T[]): T | undefined => {
    return array[array.length - 1]
  },

  tail: <T>(array: T[]): T[] => {
    return array.slice(1)
  },

  initial: <T>(array: T[]): T[] => {
    return array.slice(0, -1)
  },

  reverse: <T>(array: T[]): T[] => {
    return [...array].reverse()
  },

  zip: <T>(...arrays: T[][]): T[][] => {
    const maxLength = Math.max(...arrays.map((arr) => arr.length))
    const result: T[][] = []
    for (let i = 0; i < maxLength; i++) {
      result.push(arrays.map((arr) => arr[i]))
    }
    return result
  },

  intersection: <T>(...arrays: T[][]): T[] => {
    if (arrays.length === 0) return []
    const [first, ...rest] = arrays
    return first.filter((item) => rest.every((arr) => arr.includes(item)))
  },

  difference: <T>(array: T[], ...others: T[][]): T[] => {
    const otherValues = new Set(others.flat())
    return array.filter((item) => !otherValues.has(item))
  },

  union: <T>(...arrays: T[][]): T[] => {
    return [...new Set(arrays.flat())]
  },

  range: (start: number, end?: number, step = 1): number[] => {
    if (end === undefined) {
      end = start
      start = 0
    }
    const result: number[] = []
    for (let i = start; step > 0 ? i < end : i > end; i += step) {
      result.push(i)
    }
    return result
  },

  debounce: <T extends (...args: any[]) => any>(fn: T, delay: number): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => fn(...args), delay)
    }
  },

  throttle: <T extends (...args: any[]) => any>(fn: T, delay: number): ((...args: Parameters<T>) => void) => {
    let lastCall = 0
    return (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCall >= delay) {
        lastCall = now
        fn(...args)
      }
    }
  },

  memoize: <T extends (...args: any[]) => any>(fn: T): T => {
    const cache = new Map()
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args)
      if (cache.has(key)) {
        return cache.get(key)
      }
      const result = fn(...args)
      cache.set(key, result)
      return result
    }) as T
  },

  cloneDeep: <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime()) as T
    if (Array.isArray(obj)) return obj.map((item) => _.cloneDeep(item)) as T
    if (obj instanceof Object) {
      const cloned = {} as T
      for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
          cloned[key] = _.cloneDeep(obj[key])
        }
      }
      return cloned
    }
    return obj
  },

  get: (obj: any, path: string | string[], defaultValue?: any): any => {
    const keys = typeof path === 'string' ? path.split('.') : path
    let result = obj
    for (const key of keys) {
      result = result?.[key]
      if (result === undefined) return defaultValue
    }
    return result
  },

  set: (obj: any, path: string | string[], value: any): void => {
    const keys = typeof path === 'string' ? path.split('.') : path
    const lastKey = keys.pop()!
    let current = obj
    for (const key of keys) {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }
    current[lastKey] = value
  },

  omit: <T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
    const result = { ...obj }
    keys.forEach((key) => {
      delete result[key]
    })
    return result
  },

  pick: <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
    const result = {} as Pick<T, K>
    keys.forEach((key) => {
      if (key in obj) {
        result[key] = obj[key]
      }
    })
    return result
  },

  isEmpty: (value: any): boolean => {
    if (value == null) return true
    if (typeof value === 'boolean') return false
    if (typeof value === 'number') return false
    if (typeof value === 'string') return value.length === 0
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.keys(value).length === 0
    return false
  },

  isEqual: (a: any, b: any): boolean => {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a !== typeof b) return false
    if (typeof a !== 'object') return false

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false

    return keysA.every((key) => _.isEqual(a[key], b[key]))
  }
}

export default _
export { Chain }
