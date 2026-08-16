import type { ComponentType } from 'react'
import type { PreviewProps } from './registry.ts'
import { StatusPreview, formatBytes } from './status.tsx'
import { hexdump } from './hexdump.ts'

/** Decode a base64 string into a Uint8Array (browser `atob`). */
function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export const BinaryPreview: ComponentType<PreviewProps> = (props) => {
  const { preview, t } = props
  if (preview.kind !== 'binary') {
    return <StatusPreview {...props} />
  }
  const bytes = decodeBase64(preview.bytes)
  const text = hexdump(bytes)
  return (
    <div className="dsh-fe-hex">
      <div className="dsh-fe-hex-meta">
        <span>{formatBytes(preview.size)}</span>
        {preview.truncated && (
          <span>{t('hexTruncated', { shown: formatBytes(bytes.length), total: formatBytes(preview.size) })}</span>
        )}
      </div>
      <pre className="dsh-fe-code"><code>{text}</code></pre>
    </div>
  )
}
