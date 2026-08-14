// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
import { interceptFileLinks } from '../src/client/intercept.ts'

describe('interceptFileLinks', () => {
  test('click on button[class*="_fileLink"] reads textContent, calls openFile, prevents default + stops propagation, returns true', () => {
    const openFile = vi.fn()

    // Build a minimal DOM fragment
    const container = document.createElement('div')
    container.innerHTML = `
      <button class="some_fileLink_abc">src/a.ts</button>
    `
    document.body.appendChild(container)

    const button = container.querySelector('button') as HTMLButtonElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    vi.spyOn(event, 'preventDefault')
    vi.spyOn(event, 'stopImmediatePropagation')

    // Simulate the event target being the button itself
    Object.defineProperty(event, 'target', { value: button, writable: false })

    const result = interceptFileLinks(event, openFile)

    expect(result).toBe(true)
    expect(openFile).toHaveBeenCalledWith('src/a.ts')
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopImmediatePropagation).toHaveBeenCalled()

    document.body.removeChild(container)
  })

  test('click on [data-produced-files-row] button[class*="_file"] reads title attribute, calls openFile', () => {
    const openFile = vi.fn()

    const container = document.createElement('div')
    container.innerHTML = `
      <div data-produced-files-row>
        <button class="some_file_xyz" title="src/b.ts" aria-label="Open src/b.ts">📄</button>
      </div>
    `
    document.body.appendChild(container)

    const button = container.querySelector('button') as HTMLButtonElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    vi.spyOn(event, 'preventDefault')
    vi.spyOn(event, 'stopImmediatePropagation')

    Object.defineProperty(event, 'target', { value: button, writable: false })

    const result = interceptFileLinks(event, openFile)

    expect(result).toBe(true)
    expect(openFile).toHaveBeenCalledWith('src/b.ts')
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopImmediatePropagation).toHaveBeenCalled()

    document.body.removeChild(container)
  })

  test('click on an unrelated button returns false and does NOT call preventDefault', () => {
    const openFile = vi.fn()

    const container = document.createElement('div')
    container.innerHTML = `
      <button class="some-other-button">Save</button>
    `
    document.body.appendChild(container)

    const button = container.querySelector('button') as HTMLButtonElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    vi.spyOn(event, 'preventDefault')
    vi.spyOn(event, 'stopImmediatePropagation')

    Object.defineProperty(event, 'target', { value: button, writable: false })

    const result = interceptFileLinks(event, openFile)

    expect(result).toBe(false)
    expect(openFile).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()

    document.body.removeChild(container)
  })

  test('click on a produced-file button without title returns false', () => {
    const openFile = vi.fn()

    const container = document.createElement('div')
    container.innerHTML = `
      <div data-produced-files-row>
        <button class="some_file_xyz">📄</button>
      </div>
    `
    document.body.appendChild(container)

    const button = container.querySelector('button') as HTMLButtonElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    vi.spyOn(event, 'preventDefault')

    Object.defineProperty(event, 'target', { value: button, writable: false })

    const result = interceptFileLinks(event, openFile)

    expect(result).toBe(false)
    expect(openFile).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()

    document.body.removeChild(container)
  })

  test('click on a file-link button with empty text returns false', () => {
    const openFile = vi.fn()

    const container = document.createElement('div')
    container.innerHTML = `
      <button class="some_fileLink_abc"></button>
    `
    document.body.appendChild(container)

    const button = container.querySelector('button') as HTMLButtonElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    vi.spyOn(event, 'preventDefault')

    Object.defineProperty(event, 'target', { value: button, writable: false })

    const result = interceptFileLinks(event, openFile)

    expect(result).toBe(false)
    expect(openFile).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()

    document.body.removeChild(container)
  })
})