import { describe, expect, it } from 'vitest'
import { WidgetActionType } from './types'

describe('WidgetActionType', () => {
  it('keeps the public action values stable', () => {
    expect(Object.values(WidgetActionType)).toEqual(['deposit', 'withdraw', 'migrate'])
  })
})
