/** Format a byte array as `hexdump -C`-style text (offset, 2×8 hex groups, ASCII gutter). */
export function hexdump(bytes: Uint8Array): string {
  const lines: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 16) {
    lines.push(formatLine(offset, bytes.subarray(offset, offset + 16)))
  }
  return lines.join('\n')
}

/** Format one 1–16 byte line; the ASCII gutter is fixed at column 60. */
function formatLine(offset: number, chunk: Uint8Array): string {
  const hex = Array.from(chunk, (b) => b.toString(16).padStart(2, '0'))
  const left = hex.slice(0, 8).join(' ')
  const right = hex.slice(8).join(' ')
  const hexPart = right.length > 0 ? `${left}  ${right}` : left
  const ascii = Array.from(chunk, (b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')).join('')
  return `${offset.toString(16).padStart(8, '0')}  ${hexPart.padEnd(48, ' ')}  |${ascii}|`
}
