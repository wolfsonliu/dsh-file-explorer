// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { TextPreview } from '../src/client/preview/text.tsx'
import { MarkdownPreview } from '../src/client/preview/markdown.tsx'
import { ImagePreview } from '../src/client/preview/image.tsx'
import { BinaryPreview } from '../src/client/preview/binary.tsx'
import { formatBytes } from '../src/client/preview/status.tsx'
import {
  registerBuiltinPreviews,
  resolvePreviewFor,
} from '../src/client/preview/index.ts'
import { resolvePreview, registerPreview } from '../src/client/preview/registry.ts'
import type { PreviewProps } from '../src/client/preview/registry.ts'
import type { FilePreview } from '../src/protocol.ts'

/** Render a React element into a jsdom container and return the container. */
function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return container
}

function props(
  overrides: Partial<FilePreview> & { kind: FilePreview['kind'] },
  t: PreviewProps['t'] = (key) => key,
): PreviewProps {
  const base = {
    name: 'test.txt',
    size: 0,
    ...overrides,
  } as FilePreview
  return {
    preview: base,
    filePath: '/test/test.txt',
    activeView: 'preview' as const,
    t,
  }
}

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------
describe('formatBytes', () => {
  test('0 B', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  test('1024 → 1.0 KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  test('1048576 → 1.0 MB', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })
})

// ---------------------------------------------------------------------------
// BinaryPreview (hexdump; delegates empty/too-large to StatusPreview)
// ---------------------------------------------------------------------------
describe('BinaryPreview', () => {
  // A marker translator proves StatusPreview calls `t` with the right key,
  // rather than rendering a hardcoded Chinese string.
  const t: PreviewProps['t'] = (key) => `T:${key}`

  test('renders hexdump for {kind: "binary"}', () => {
    const p = props({ kind: 'binary', name: 'data.bin', size: 3, bytes: 'AAEC', truncated: false })
    const container = render(<BinaryPreview {...p} />)
    const code = container.querySelector('pre.dsh-fe-code code')
    expect(code).toBeTruthy()
    expect(code!.textContent).toContain('00000000  00 01 02')
    expect(code!.textContent).toContain('|...|')
    expect(container.textContent).toContain('3 B')
  })

  test('shows a truncation note with formatted shown/total sizes', () => {
    const tWithParams: PreviewProps['t'] = (key, params) => `T:${key}:${String(params?.shown)}/${String(params?.total)}`
    const p = props({ kind: 'binary', name: 'data.bin', size: 70000, bytes: 'AAEC', truncated: true }, tWithParams)
    const container = render(<BinaryPreview {...p} />)
    expect(container.textContent).toContain('T:hexTruncated:3 B/68.4 KB')
  })

  test('shows too-large message for {kind: "too-large"}', () => {
    const p = props({ kind: 'too-large', name: 'big.txt', size: 1048576 }, t)
    const container = render(<BinaryPreview {...p} />)
    expect(container.textContent).toContain('T:tooLarge')
    expect(container.textContent).toContain('big.txt')
    expect(container.textContent).toContain('1.0 MB')
  })

  test('shows empty message for {kind: "empty"}', () => {
    const p = props({ kind: 'empty', name: 'empty.txt', size: 0 }, t)
    const container = render(<BinaryPreview {...p} />)
    expect(container.textContent).toContain('T:emptyFile')
    expect(container.textContent).toContain('empty.txt')
  })
})

// ---------------------------------------------------------------------------
// TextPreview
// ---------------------------------------------------------------------------
describe('TextPreview', () => {
  test('renders preview.content for {kind: "text"}', () => {
    const p = props({
      kind: 'text',
      name: 'hello.ts',
      content: 'const x = 1',
      extension: 'ts',
      size: 13,
    })
    const container = render(<TextPreview {...p} />)
    // Should render the content inside <pre><code>
    const code = container.querySelector('code')
    expect(code).toBeTruthy()
    expect(code!.textContent).toBe('const x = 1')
  })

  test('renders a .dsh-fe-code pre wrapper', () => {
    const p = props({ kind: 'text', name: 'hello.ts', content: 'const x = 1', extension: 'ts', size: 13 })
    const container = render(<TextPreview {...p} />)
    expect(container.querySelector('pre.dsh-fe-code')).toBeTruthy()
  })

  test('renders StatusPreview for non-text kind', () => {
    const p = props({ kind: 'too-large', name: 'big.txt', size: 1048576 })
    const container = render(<TextPreview {...p} />)
    // Should fall back to StatusPreview, showing the translated too-large message
    expect(container.textContent).toContain('tooLarge')
  })
})

// ---------------------------------------------------------------------------
// MarkdownPreview
// ---------------------------------------------------------------------------
describe('MarkdownPreview', () => {
  test('renders <h1> for # Hi when activeView is preview', () => {
    const p = {
      ...props({
        kind: 'text',
        name: 'readme.md',
        content: '# Hi',
        extension: 'md',
        size: 4,
      }),
      activeView: 'preview' as const,
    }
    const container = render(<MarkdownPreview {...p} />)
    const h1 = container.querySelector('h1')
    expect(h1).toBeTruthy()
    expect(h1!.textContent).toBe('Hi')
  })

  test('renders preview content inside a .dsh-fe-md-content wrapper', () => {
    const p = {
      ...props({
        kind: 'text',
        name: 'readme.md',
        content: '# Hi',
        extension: 'md',
        size: 4,
      }),
      activeView: 'preview' as const,
    }
    const container = render(<MarkdownPreview {...p} />)
    expect(container.querySelector('.dsh-fe-md-content')).toBeTruthy()
  })

  test('renders raw # Hi when activeView is source', () => {
    const p = {
      ...props({
        kind: 'text',
        name: 'readme.md',
        content: '# Hi',
        extension: 'md',
        size: 4,
      }),
      activeView: 'source' as const,
    }
    const container = render(<MarkdownPreview {...p} />)
    const code = container.querySelector('code')
    expect(code).toBeTruthy()
    expect(code!.textContent).toBe('# Hi')
  })

  test('renders source view inside a .dsh-fe-code pre wrapper', () => {
    const p = {
      ...props({
        kind: 'text',
        name: 'readme.md',
        content: '# Hi',
        extension: 'md',
        size: 4,
      }),
      activeView: 'source' as const,
    }
    const container = render(<MarkdownPreview {...p} />)
    expect(container.querySelector('pre.dsh-fe-code')).toBeTruthy()
  })

  test('renders StatusPreview for non-text kind', () => {
    const p = {
      ...props({ kind: 'too-large', name: 'big.txt', size: 1048576 }),
      activeView: 'preview' as const,
    }
    const container = render(<MarkdownPreview {...p} />)
    expect(container.textContent).toContain('tooLarge')
  })
})

// ---------------------------------------------------------------------------
// ImagePreview
// ---------------------------------------------------------------------------
describe('ImagePreview', () => {
  test('renders <img> with src=dataUrl for {kind: "image"}', () => {
    const p = props({
      kind: 'image',
      name: 'photo.png',
      mime: 'image/png',
      dataUrl: 'data:image/png;base64,abc123',
      size: 100,
    })
    const container = render(<ImagePreview {...p} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img!.getAttribute('src')).toBe('data:image/png;base64,abc123')
    expect(img!.getAttribute('alt')).toBe('photo.png')
  })

  test('renders StatusPreview for non-image kind', () => {
    const p = props({ kind: 'too-large', name: 'big.txt', size: 1048576 })
    const container = render(<ImagePreview {...p} />)
    expect(container.textContent).toContain('tooLarge')
  })
})

// ---------------------------------------------------------------------------
// registerBuiltinPreviews
// ---------------------------------------------------------------------------
describe('registerBuiltinPreviews', () => {
  test('resolvePreview("md") returns markdown component', () => {
    registerBuiltinPreviews()
    const comp = resolvePreview('md')
    expect(comp).toBe(MarkdownPreview)
  })

  test('resolvePreview("ts") returns text component', () => {
    registerBuiltinPreviews()
    const comp = resolvePreview('ts')
    expect(comp).toBe(TextPreview)
  })

  test('resolvePreview("png") returns image component', () => {
    registerBuiltinPreviews()
    const comp = resolvePreview('png')
    expect(comp).toBe(ImagePreview)
  })

  test('resolvePreview("unknown") returns binary component', () => {
    registerBuiltinPreviews()
    const comp = resolvePreview('unknown')
    expect(comp).toBe(BinaryPreview)
  })
})

// ---------------------------------------------------------------------------
// resolvePreviewFor (kind-aware routing)
// ---------------------------------------------------------------------------
describe('resolvePreviewFor', () => {
  test('text kind with empty extension (LICENSE) uses TextPreview', () => {
    registerBuiltinPreviews()
    const comp = resolvePreviewFor({ kind: 'text', name: 'LICENSE', extension: '', content: 'MIT', size: 3 }, '')
    expect(comp).toBe(TextPreview)
  })

  test('text kind with md extension uses MarkdownPreview', () => {
    registerBuiltinPreviews()
    const comp = resolvePreviewFor({ kind: 'text', name: 'x.md', extension: '.md', content: '# hi', size: 3 }, 'md')
    expect(comp).toBe(MarkdownPreview)
  })

  test('image kind uses ImagePreview', () => {
    registerBuiltinPreviews()
    const comp = resolvePreviewFor({ kind: 'image', name: 'x.png', mime: 'image/png', dataUrl: 'data:image/png;base64,', size: 1 }, 'png')
    expect(comp).toBe(ImagePreview)
  })

  test('binary kind uses BinaryPreview', () => {
    registerBuiltinPreviews()
    const comp = resolvePreviewFor({ kind: 'binary', name: 'x.bin', size: 4 }, '')
    expect(comp).toBe(BinaryPreview)
  })
})