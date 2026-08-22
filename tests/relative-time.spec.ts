import { describe, expect, test } from 'vitest'
import { formatRelativeTime, relativeTime } from '../src/client/relative-time.ts'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('relativeTime', () => {
  test('buckets into now/minutes/hours/days/months/years', () => {
    const now = 1_000_000_000
    expect(relativeTime(now - 1, now)).toEqual({ unit: 'now', n: 0 })
    expect(relativeTime(now - 5 * MIN, now)).toEqual({ unit: 'minutes', n: 5 })
    expect(relativeTime(now - 3 * HOUR, now)).toEqual({ unit: 'hours', n: 3 })
    expect(relativeTime(now - 2 * DAY, now)).toEqual({ unit: 'days', n: 2 })
    expect(relativeTime(now - 40 * DAY, now)).toEqual({ unit: 'months', n: 1 })
    expect(relativeTime(now - 400 * DAY, now)).toEqual({ unit: 'years', n: 1 })
  })

  test('clamps future timestamps to now', () => {
    const now = 1_000_000_000
    expect(relativeTime(now + 1000, now)).toEqual({ unit: 'now', n: 0 })
  })

  test('months bucket clamps at 11 before rolling to years', () => {
    const now = 1_000_000_000
    expect(relativeTime(now - 359 * DAY, now)).toEqual({ unit: 'months', n: 11 })
    expect(relativeTime(now - 360 * DAY, now)).toEqual({ unit: 'months', n: 11 })
    expect(relativeTime(now - 364 * DAY, now)).toEqual({ unit: 'months', n: 11 })
    expect(relativeTime(now - 365 * DAY, now)).toEqual({ unit: 'years', n: 1 })
  })

  test('formats through the translator with interpolation', () => {
    const t = (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key}:${String(params.n)}`
    const now = 1_000_000_000
    expect(formatRelativeTime(t, now - 1, now)).toBe('timeNow')
    expect(formatRelativeTime(t, now - 5 * MIN, now)).toBe('timeMinutes:5')
  })
})
