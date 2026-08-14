// @vitest-environment jsdom
import { describe, expect, test, afterEach, vi } from 'vitest'
import { findSidebarTree, mountSidebar } from '../src/client/mount-sidebar.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('findSidebarTree', () => {
  test('returns the [role="tree"] element when present', () => {
    const tree = document.createElement('div')
    tree.setAttribute('role', 'tree')
    document.body.appendChild(tree)

    expect(findSidebarTree(document.body)).toBe(tree)
  })

  test('returns null when absent', () => {
    expect(findSidebarTree(document.body)).toBeNull()
  })

  test('finds the tree when nested deeply', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = '<main><aside><section><div role="tree"></div></section></aside></main>'
    document.body.appendChild(wrapper)

    const tree = wrapper.querySelector<HTMLElement>('[role="tree"]')
    expect(tree).not.toBeNull()
    expect(findSidebarTree(document.body)).toBe(tree)
  })
})

describe('mountSidebar', () => {
  test('calls onReady once with a data-fe-sidebar-host element after a [role="tree"] is appended', async () => {
    const onReady = vi.fn()
    const dispose = mountSidebar(onReady)

    // No tree yet, so onReady must not fire synchronously.
    expect(onReady).not.toHaveBeenCalled()

    const tree = document.createElement('div')
    tree.setAttribute('role', 'tree')
    document.body.appendChild(tree)

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1))

    const host = document.body.querySelector<HTMLElement>('[data-fe-sidebar-host]')
    expect(host).not.toBeNull()
    expect(host!.hasAttribute('data-fe-sidebar-host')).toBe(true)
    // Host is injected as a sibling after the tree.
    expect(tree.nextElementSibling).toBe(host)
    // Host is contained within the session-list wrapper (absolute, inset: 0)
    // and its parent is the positioning context.
    expect(host!.style.position).toBe('absolute')
    expect(host!.style.inset).toBe('0')
    expect(tree.parentElement!.style.position).toBe('relative')
    expect(onReady.mock.calls[0][0]).toBe(host)

    dispose()
  })

  test('does not call onReady when no tree is added', async () => {
    const onReady = vi.fn()
    const dispose = mountSidebar(onReady)

    // Mutate the body without introducing a [role="tree"].
    document.body.appendChild(document.createElement('div'))
    await tick()

    expect(onReady).not.toHaveBeenCalled()

    dispose()
  })

  test('the disposer removes the host element and stops further onReady calls', async () => {
    const onReady = vi.fn()
    const dispose = mountSidebar(onReady)

    const tree = document.createElement('div')
    tree.setAttribute('role', 'tree')
    document.body.appendChild(tree)

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1))

    dispose()

    expect(document.body.querySelector('[data-fe-sidebar-host]')).toBeNull()

    // A later tree must not trigger a second onReady call.
    const secondTree = document.createElement('div')
    secondTree.setAttribute('role', 'tree')
    document.body.appendChild(secondTree)
    await tick()

    expect(onReady).toHaveBeenCalledTimes(1)
  })

  test('calls onReady synchronously once when the tree already exists', () => {
    const tree = document.createElement('div')
    tree.setAttribute('role', 'tree')
    document.body.appendChild(tree)

    const onReady = vi.fn()
    const dispose = mountSidebar(onReady)

    expect(onReady).toHaveBeenCalledTimes(1)

    const host = document.body.querySelector<HTMLElement>('[data-fe-sidebar-host]')
    expect(host).not.toBeNull()
    expect(onReady.mock.calls[0][0]).toBe(host)
    expect(tree.nextElementSibling).toBe(host)

    dispose()
  })
})
