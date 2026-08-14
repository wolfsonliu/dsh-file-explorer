import { describe, expect, test } from 'vitest'
import {
  registerPreview,
  resolvePreview,
  previewKeyOf,
} from '../src/client/preview/registry.ts'
import type { PreviewProps } from '../src/client/preview/registry.ts'

// Stub components — just functions that return null
const A = (_props: PreviewProps) => null
const B = (_props: PreviewProps) => null
const C = (_props: PreviewProps) => null
const BinaryFallback = (_props: PreviewProps) => null

describe('preview registry', () => {
  test('resolvePreview returns registered component for exact extension', () => {
    registerPreview('md', A)
    expect(resolvePreview('md')).toBe(A)
  })

  test('resolvePreview returns registered component for a different extension', () => {
    registerPreview('ts', B)
    expect(resolvePreview('ts')).toBe(B)
  })

  test('resolvePreview returns binary fallback for unregistered extension', () => {
    registerPreview('binary', BinaryFallback)
    expect(resolvePreview('cif')).toBe(BinaryFallback)
  })

  test('previewKeyOf is case-insensitive', () => {
    registerPreview('png', A)
    expect(previewKeyOf('PNG')).toBe('png')
  })

  test('previewKeyOf returns binary for unregistered extension', () => {
    expect(previewKeyOf('unknown')).toBe('binary')
  })

  test('re-registering an extension replaces the component (last-wins)', () => {
    registerPreview('md', A)
    registerPreview('md', C)
    expect(resolvePreview('md')).toBe(C)
  })
})

describe('preview registry priority', () => {
  test('higher priority wins even when registered first', () => {
    registerPreview('prio-first', B, 10)
    registerPreview('prio-first', A, 0)
    expect(resolvePreview('prio-first')).toBe(B)
  })

  test('higher priority wins when registered later', () => {
    registerPreview('prio-later', A, 0)
    registerPreview('prio-later', B, 10)
    expect(resolvePreview('prio-later')).toBe(B)
  })

  test('equal priority: later registration wins', () => {
    registerPreview('prio-equal', A, 0)
    registerPreview('prio-equal', B, 0)
    expect(resolvePreview('prio-equal')).toBe(B)
  })

  test('disposer removes only its own entry', () => {
    const disposeA = registerPreview('prio-dispose', A, 10)
    registerPreview('prio-dispose', B, 0)
    disposeA()
    expect(resolvePreview('prio-dispose')).toBe(B)
  })

  test('disposer is idempotent', () => {
    const dispose = registerPreview('prio-idem', A, 10)
    dispose()
    dispose()
    expect(previewKeyOf('prio-idem')).toBe('binary')
  })

  test('disposing the last entry deletes the key', () => {
    const dispose = registerPreview('prio-solo', A)
    expect(previewKeyOf('prio-solo')).toBe('prio-solo')
    dispose()
    expect(previewKeyOf('prio-solo')).toBe('binary')
  })

  test('resolvePreview of an unknown extension returns the binary fallback', () => {
    registerPreview('binary', BinaryFallback)
    expect(resolvePreview('some-unknown-ext')).toBe(BinaryFallback)
  })

  test('previewKeyOf returns the ext after registration and binary otherwise', () => {
    registerPreview('prio-key', A)
    expect(previewKeyOf('prio-key')).toBe('prio-key')
    expect(previewKeyOf('no-such-ext')).toBe('binary')
  })
})