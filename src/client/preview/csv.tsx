import type { ComponentType } from 'react'
import { parseCsv } from './csv.ts'
import type { PreviewProps } from './registry.ts'
import { StatusPreview } from './status.tsx'
import { makeTextPagedPreview, type ReadRawFile } from './text-large.tsx'

const CSV_MAX_ROWS = 1000
const CSV_MAX_COLS = 256

const cache = new Map<ReadRawFile | undefined, ComponentType<PreviewProps>>()

/** Build (and memoize) the built-in CSV preview for a given reader. */
export function makeCsvPreview(readRawFile?: ReadRawFile): ComponentType<PreviewProps> {
  const hit = cache.get(readRawFile)
  if (hit !== undefined) return hit
  const Component: ComponentType<PreviewProps> = (props) => (
    <CsvPreviewInner {...props} readRawFile={readRawFile} />
  )
  cache.set(readRawFile, Component)
  return Component
}

function CsvPreviewInner(props: PreviewProps & { readRawFile?: ReadRawFile }) {
  const { preview } = props
  if (preview.kind === 'text') {
    return <CsvTable content={preview.content} t={props.t} />
  }
  // text-large (>2 MiB): reuse the paged text renderer when a reader exists.
  if (preview.kind === 'text-large' && props.readRawFile !== undefined) {
    const Paged = makeTextPagedPreview(props.readRawFile)
    return <Paged {...props} />
  }
  return <StatusPreview {...props} />
}

function CsvTable({ content, t }: { content: string; t: PreviewProps['t'] }) {
  const rows = parseCsv(content)
  if (rows.length === 0) {
    return <div className="dsh-fe-preview-empty" data-fe-csv-empty>{t('emptyFile')}</div>
  }
  const header = rows[0]
  const body = rows.slice(1)
  const rowsShown = body.slice(0, CSV_MAX_ROWS)
  const rowsTruncated = body.length > CSV_MAX_ROWS
  const maxCols = Math.max(header.length, ...rowsShown.map((r) => r.length))
  const colsTruncated = maxCols > CSV_MAX_COLS
  const cols = Math.min(maxCols, CSV_MAX_COLS)
  const pad = (cells: string[]): string[] => {
    const out = cells.slice(0, cols)
    while (out.length < cols) out.push('')
    return out
  }
  return (
    <div className="dsh-fe-csv" data-fe-csv>
      <div className="dsh-fe-csv-scroll">
        <table className="dsh-fe-table">
          <thead>
            <tr>{pad(header).map((cell, col) => <th key={col} scope="col">{cell}</th>)}</tr>
          </thead>
          <tbody>
            {rowsShown.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {pad(row).map((cell, col) => <td key={col}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(rowsTruncated || colsTruncated) && (
        <div className="dsh-fe-csv-truncated" data-fe-csv-truncated>
          {rowsTruncated && <span>{t('csvTruncated', { rows: CSV_MAX_ROWS })}</span>}
          {colsTruncated && <span>{t('csvTruncatedCols', { cols: CSV_MAX_COLS })}</span>}
        </div>
      )}
    </div>
  )
}
