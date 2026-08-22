/**
 * Parse RFC-4180-ish CSV text into rows of string fields.
 * Handles quoted fields, doubled-quote escapes, and embedded commas/newlines.
 * Malformed or unterminated quotes are massaged rather than rejected.
 */
export declare function parseCsv(text: string): string[][];
