import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import type { PreviewProps } from './registry.ts'
import { StatusPreview, formatBytes } from './status.tsx'

export type ReadRawFile = (path: string, offset?: number, limit?: number) => Promise<ArrayBuffer>

const CHUNK_SIZE = 512 * 1024 // 512 KiB

const cache = new Map<ReadRawFile | undefined, ComponentType<PreviewProps>>()

/** Build (and memoize) the built-in paged text renderer for a given reader. */
export function makeTextPagedPreview(readRawFile?: ReadRawFile): ComponentType<PreviewProps> {
  const hit = cache.get(readRawFile)
  if (hit !== undefined) return hit
  const Component: ComponentType<PreviewProps> = (props) => (
    <TextPagedPreviewInner {...props} readRawFile={readRawFile} />
  )
  cache.set(readRawFile, Component)
  return Component
}

function TextPagedPreviewInner(props: PreviewProps & { readRawFile?: ReadRawFile }) {
  const { preview } = props
  if (preview.kind === 'text') {
    return (
      <pre className="dsh-fe-code">
        <code>{preview.content}</code>
      </pre>
    )
  }
  if (preview.kind !== 'text-large' || props.readRawFile === undefined) {
    return <StatusPreview {...props} />
  }
  return <PagedContent single={props} readRawFile={props.readRawFile} total={preview.size} />
}

function PagedContent({
  single,
  readRawFile,
  total,
}: {
  single: PreviewProps
  readRawFile: ReadRawFile
  total: number
}) {
  const { preview, filePath, t } = single
  const [chunks, setChunks] = useState<string[]>([])
  const [loaded, setLoaded] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const loadTokenRef = useRef(0)
  const decoderRef = useRef(new TextDecoder('utf-8', { fatal: false }))
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Load the first chunk when this file is shown (also resets on file change).
  useEffect(() => {
    let cancelled = false
    loadTokenRef.current += 1
    const token = loadTokenRef.current
    setError(null)
    setChunks([])
    setLoaded(0)
    decoderRef.current = new TextDecoder('utf-8', { fatal: false })
    void readRawFile(filePath, 0, CHUNK_SIZE)
      .then((bytes) => {
        if (cancelled || !mountedRef.current || loadTokenRef.current !== token) return
        let text = decoderRef.current.decode(new Uint8Array(bytes), { stream: true })
        if (bytes.byteLength >= total) text += decoderRef.current.decode()
        setChunks([text])
        setLoaded(bytes.byteLength)
      })
      .catch((err: unknown) => {
        if (!cancelled && mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [filePath, readRawFile, total])

  const loadMore = useCallback(() => {
    if (loading || loaded >= total) return
    setLoading(true)
    const offset = loaded
    const token = loadTokenRef.current
    void readRawFile(filePath, offset, CHUNK_SIZE)
      .then((bytes) => {
        if (!mountedRef.current || loadTokenRef.current !== token) return
        let text = decoderRef.current.decode(new Uint8Array(bytes), { stream: true })
        if (offset + bytes.byteLength >= total) text += decoderRef.current.decode()
        setChunks((prev) => [...prev, text])
        setLoaded(offset + bytes.byteLength)
      })
      .catch((err: unknown) => {
        if (mountedRef.current) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
  }, [filePath, readRawFile, total, loaded, loading])

  const onScroll = useCallback(() => {
    const el = bodyRef.current
    if (el === null) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadMore()
  }, [loadMore])

  const hasMore = loaded < total

  return (
    <div className="dsh-fe-text-large" data-fe-text-large>
      <div className="dsh-fe-text-large-meta">
        <span className="dsh-fe-name">{preview.name}</span>
        <span data-fe-text-large-status>
          {t('textLoaded', { loaded: formatBytes(loaded), total: formatBytes(total) })}
        </span>
        <button
          type="button"
          className="dsh-fe-btn"
          data-fe-load-more
          onClick={loadMore}
          disabled={loading || !hasMore}
        >
          {t('loadMore')}
        </button>
      </div>
      <div className="dsh-fe-text-large-body" ref={bodyRef} onScroll={onScroll}>
        <pre className="dsh-fe-code">
          <code data-fe-text-large-content>{chunks.join('')}</code>
        </pre>
      </div>
      {error !== null && <div className="dsh-fe-preview-error">{error}</div>}
    </div>
  )
}
