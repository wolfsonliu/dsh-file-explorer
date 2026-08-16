import { describe, expect, test } from 'vitest'
import { hexdump } from '../src/client/preview/hexdump.ts'

describe('hexdump', () => {
  test('formats a full 16-byte line like hexdump -C', () => {
    const bytes = new Uint8Array([
      0x23, 0x20, 0x64, 0x73, 0x68, 0x2d, 0x66, 0x69,
      0x6c, 0x65, 0x2d, 0x65, 0x78, 0x70, 0x6c, 0x6f,
    ])
    expect(hexdump(bytes)).toBe(
      '00000000  23 20 64 73 68 2d 66 69  6c 65 2d 65 78 70 6c 6f  |# dsh-file-explo|',
    )
  })

  test('pads a short final line so the ASCII gutter stays aligned', () => {
    expect(hexdump(new Uint8Array([0x00, 0x01, 0x02]))).toBe(
      '00000000  00 01 02' + ' '.repeat(42) + '|...|',
    )
  })

  test('splits the byte groups with a double space after byte 8', () => {
    expect(hexdump(new Uint8Array([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a]))).toBe(
      '00000000  61 62 63 64 65 66 67 68  69 6a' + ' '.repeat(20) + '|abcdefghij|',
    )
  })

  test('continues offsets across multiple lines', () => {
    const bytes = new Uint8Array('abcdefghijklmnopq'.split('').map(c => c.charCodeAt(0)))
    expect(hexdump(bytes)).toBe(
      '00000000  61 62 63 64 65 66 67 68  69 6a 6b 6c 6d 6e 6f 70  |abcdefghijklmnop|\n' +
      '00000010  71' + ' '.repeat(48) + '|q|',
    )
  })

  test('replaces non-printable bytes with dots in the ASCII gutter', () => {
    expect(hexdump(new Uint8Array([0x00, 0x41, 0x7f]))).toBe(
      '00000000  00 41 7f' + ' '.repeat(42) + '|.A.|',
    )
  })

  test('returns an empty string for no bytes', () => {
    expect(hexdump(new Uint8Array([]))).toBe('')
  })
})
