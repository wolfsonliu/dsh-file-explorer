// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import {
  IconPanelLeft,
  IconClose,
  IconFolderOpen,
  IconFolderClose,
  IconChevronRight,
  IconRefresh,
  IconCopy,
  IconFullscreen,
  IconFile,
  IconEllipsis,
  IconSearch,
} from '../src/client/icons.tsx'

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

const ICONS: ReadonlyArray<readonly [string, (props: { size?: number; className?: string }) => React.ReactElement]> = [
  ['IconPanelLeft', IconPanelLeft],
  ['IconClose', IconClose],
  ['IconFolderOpen', IconFolderOpen],
  ['IconFolderClose', IconFolderClose],
  ['IconChevronRight', IconChevronRight],
  ['IconRefresh', IconRefresh],
  ['IconCopy', IconCopy],
  ['IconFullscreen', IconFullscreen],
  ['IconFile', IconFile],
  ['IconEllipsis', IconEllipsis],
  ['IconSearch', IconSearch],
]

describe('icons', () => {
  for (const [name, Icon] of ICONS) {
    test(`${name} renders an <svg> element`, () => {
      const container = render(<Icon />)
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg!.getAttribute('viewBox')).toBeTruthy()
    })

    test(`${name} paths use currentColor`, () => {
      const container = render(<Icon />)
      const paths = container.querySelectorAll('path')
      expect(paths.length).toBeGreaterThan(0)
      for (const path of Array.from(paths)) {
        expect(path.getAttribute('fill')).toBe('currentColor')
      }
    })
  }

  test('IconFolderOpen and IconFolderClose produce different path data', () => {
    const open = render(<IconFolderOpen />)
    const close = render(<IconFolderClose />)
    const openData = Array.from(open.querySelectorAll('path'))
      .map((p) => p.getAttribute('d'))
      .join('')
    const closeData = Array.from(close.querySelectorAll('path'))
      .map((p) => p.getAttribute('d'))
      .join('')
    expect(openData).not.toBe('')
    expect(closeData).not.toBe('')
    expect(openData).not.toBe(closeData)
  })
})
