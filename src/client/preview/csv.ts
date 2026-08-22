/**
 * Parse RFC-4180-ish CSV text into rows of string fields.
 * Handles quoted fields, doubled-quote escapes, and embedded commas/newlines.
 * Malformed or unterminated quotes are massaged rather than rejected.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let fieldOpen = false
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }
    if (char === '"' && field === '') {
      fieldOpen = true
      inQuotes = true
      i += 1
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      fieldOpen = false
      i += 1
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      field = ''
      row = []
      fieldOpen = false
      i += 1
      continue
    }
    if (char === '\r') {
      if (text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      field = ''
      row = []
      fieldOpen = false
      i += 1
      continue
    }
    field += char
    i += 1
  }
  if (field !== '' || row.length > 0 || fieldOpen) {
    row.push(field)
    rows.push(row)
  }
  return rows
}