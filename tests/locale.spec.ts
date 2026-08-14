import { describe, expect, test, vi } from 'vitest'
import {
  EN,
  FILE_EXPLORER_NS,
  ZH,
  registerFileExplorerLocale,
} from '../src/client/locale.ts'

describe('locale dictionaries', () => {
  test('ZH and EN have identical key sets', () => {
    expect(Object.keys(ZH).sort()).toEqual(Object.keys(EN).sort())
  })
})

describe('registerFileExplorerLocale', () => {
  test('registers the zh and en dictionaries under the file-explorer namespace', () => {
    const register = vi.fn(() => () => {})
    const ctx = { locale: { register } }

    const dispose = registerFileExplorerLocale(ctx)

    expect(dispose).toBeTypeOf('function')
    expect(register).toHaveBeenCalledTimes(2)
    expect(register).toHaveBeenNthCalledWith(1, FILE_EXPLORER_NS, 'zh', ZH)
    expect(register).toHaveBeenNthCalledWith(2, FILE_EXPLORER_NS, 'en', EN)
  })

  test('disposer removes both registered locales', () => {
    const d1 = vi.fn()
    const d2 = vi.fn()
    const register = vi.fn()
      .mockReturnValueOnce(d1)
      .mockReturnValueOnce(d2)
    const ctx = { locale: { register } }

    const dispose = registerFileExplorerLocale(ctx)
    dispose()

    expect(d1).toHaveBeenCalledTimes(1)
    expect(d2).toHaveBeenCalledTimes(1)
  })
})
