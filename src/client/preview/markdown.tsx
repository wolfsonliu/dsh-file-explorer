import type { ComponentType } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { PreviewProps } from './registry.ts'
import { StatusPreview } from './status.tsx'

export const MarkdownPreview: ComponentType<PreviewProps> = (props) => {
  if (props.preview.kind === 'text') {
    if (props.activeView === 'source') {
      return (
        <pre>
          <code>{props.preview.content}</code>
        </pre>
      )
    }

    const html = DOMPurify.sanitize(marked.parse(props.preview.content) as string)
    return <div dangerouslySetInnerHTML={{ __html: html }} />
  }

  return <StatusPreview {...props} />
}