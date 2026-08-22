// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { VirtualList } from '../src/client/virtual-list.tsx'

function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(element))
  return container
}

describe('VirtualList', () => {
  test('renders all rows when the viewport is unmeasured (clientHeight 0)', () => {
    const container = render(
      <VirtualList rowCount={100} rowHeight={28} rowKey={(i) => i}
        renderRow={(i) => <div className="row">{i}</div>} />,
    )
    expect(container.querySelectorAll('.row').length).toBe(100)
  })

  test('renders a total-height spacer', () => {
    const container = render(
      <VirtualList rowCount={5} rowHeight={28} rowKey={(i) => i}
        renderRow={(i) => <div className="row">{i}</div>} />,
    )
    const spacer = container.querySelector('div[style]') as HTMLElement
    expect(spacer.style.height).toBe('140px') // 5 * 28
  })

  test('renders only a window once the viewport has a height', () => {
    const container = render(
      <VirtualList rowCount={100} rowHeight={28} rowKey={(i) => i}
        renderRow={(i) => <div className="row">{i}</div>} />,
    )
    const scroller = container.querySelector('.dsh-fe-virtual-list') as HTMLElement
    Object.defineProperty(scroller, 'clientHeight', { value: 280, configurable: true })
    act(() => {
      scroller.dispatchEvent(new Event('scroll'))
    })
    const rows = container.querySelectorAll('.row').length
    expect(rows).toBeGreaterThan(0)
    expect(rows).toBeLessThan(100)
  })

  test('renders variable-height rows with cumulative offsets and total height', () => {
    const container = render(
      <VirtualList rowCount={3} rowHeight={(i) => (i === 0 ? 34 : 32)} rowKey={(i) => i}
        renderRow={(i) => <div className="row">{i}</div>} />,
    )
    const spacer = container.querySelector('.dsh-fe-virtual-list > div') as HTMLElement
    expect(spacer.style.height).toBe('98px') // 34 + 32 + 32
    expect(container.querySelectorAll('.row').length).toBe(3) // unmeasured viewport renders all
  })
})