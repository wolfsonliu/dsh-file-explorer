import type { ComponentType } from 'react'
import type { PreviewProps } from './registry.ts'
import { StatusPreview } from './status.tsx'

export const BinaryPreview: ComponentType<PreviewProps> = (props) => {
  return <StatusPreview {...props} />
}