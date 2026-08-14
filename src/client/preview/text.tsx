import type { ComponentType } from 'react'
import type { PreviewProps } from './registry.ts'
import { StatusPreview } from './status.tsx'

export const TextPreview: ComponentType<PreviewProps> = (props) => {
  if (props.preview.kind === 'text') {
    return (
      <pre>
        <code>{props.preview.content}</code>
      </pre>
    )
  }

  return <StatusPreview {...props} />
}