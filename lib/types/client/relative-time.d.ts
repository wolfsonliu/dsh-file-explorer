import type { Translate } from './locale.ts';
/** Relative-time bucket, matching the dsh session-row trailing label. */
export type RelativeTimeUnit = 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years';
export interface RelativeTime {
    unit: RelativeTimeUnit;
    n: number;
}
/** Bucket a timestamp against `now` (epoch ms) into a relative-time unit. */
export declare function relativeTime(updatedAt: number, now: number): RelativeTime;
/** Format a timestamp as a localized relative-time label ("now"/"5min"/"3h"…). */
export declare function formatRelativeTime(t: Translate, updatedAt: number, now: number): string;
