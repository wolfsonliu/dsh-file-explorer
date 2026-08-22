import { describe, expect, test } from 'vitest'
import { parseCsv } from '../src/client/preview/csv.ts'

describe('parseCsv', () => {
  test('splits comma-separated fields', () => {
    expect(parseCsv('a,b,c')).toEqual([['a', 'b', 'c']])
  })

  test('preserves quoted commas and newlines', () => {
    expect(parseCsv('"a,b",c\n"x\ny","z"')).toEqual([['a,b', 'c'], ['x\ny', 'z']])
  })

  test('unescapes doubled quotes inside a field', () => {
    expect(parseCsv('"say ""hi"""')).toEqual([['say "hi"']])
  })

  test('handles CRLF and drops the final trailing newline', () => {
    expect(parseCsv('a,b\r\nc,d\n')).toEqual([['a', 'b'], ['c', 'd']])
  })

  test('returns an empty list for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })
})
