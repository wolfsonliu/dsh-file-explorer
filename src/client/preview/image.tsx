import type { ComponentType } from 'react'
import type { PreviewProps } from './registry.ts'
import { StatusPreview } from './status.tsx'

export const ImagePreview: ComponentType<PreviewProps> = (props) => {
  if (props.preview.kind === 'image') {
    return <img src={props.preview.dataUrl} alt={props.preview.name} />
  }

  return <StatusPreview {...props} />
}