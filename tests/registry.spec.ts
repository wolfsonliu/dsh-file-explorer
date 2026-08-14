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