import type { ComponentType } from 'react'
import type { PreviewProps } from './registry.ts'

/** Format a byte count into a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

export const StatusPreview: ComponentType<PreviewProps> = ({ preview, filePath }) => {
  const sizeStr = formatBytes(preview.size)

  if (preview.kind === 'empty') {
    return (
      <div>
        <p>
          <strong>{preview.name}</strong>
        </p>
        <p>空文件</p>
      </div>
    )
  }

  if (preview.kind === 'binary') {
    return (
      <div>
        <p>
          <strong>{preview.name}</strong>
        </p>
        <p>无法预览此文件（二进制）</p>
        <p>{sizeStr}</p>
      </div>
    )
  }

  if (preview.kind === 'too-large') {
    return (
      <div>
        <p>
          <strong>{preview.name}</strong>
        </p>
        <p>文件过大，无法预览</p>
        <p>{sizeStr}</p>
      </div>
    )
  }

  return null
}