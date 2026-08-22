import type { Translate } from './locale.ts'

/** Relative-time bucket, matching the dsh session-row trailing label. */
export type RelativeTimeUnit = 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years'

export interface RelativeTime {
  unit: RelativeTimeUnit
  n: number
}

/** Bucket a timestamp against `now` (epoch ms) into a relative-time unit. */
export function relativeTime(updatedAt: number, now: number): RelativeTime {
  const diff = Math.max(0, now - updatedAt)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return { unit: 'now', n: 0 }
  if (minutes < 60) return { unit: 'minutes', n: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { unit: 'hours', n: hours }
  const days = Math.floor(hours / 24)
  if (days < 30) return { unit: 'days', n: days }
  const months = Math.floor(days / 30)
  if (months < 12) return { unit: 'months', n: months }
  return { unit: 'years', n: Math.floor(days / 365) }
}

/** Format a timestamp as a localized relative-time label ("now"/"5min"/"3h"…). */
export function formatRelativeTime(t: Translate, updatedAt: number, now: number): string {
  const { unit, n } = relativeTime(updatedAt, now)
  switch (unit) {
    case 'now': return t('timeNow')
    case 'minutes': return t('timeMinutes', { n })
    case 'hours': return t('timeHours', { n })
    case 'days': return t('timeDays', { n })
    case 'months': return t('timeMonths', { n })
    case 'years': return t('timeYears', { n })
  }
}