/**
 * Intercept click events on tool-row file links and produced-file chips so
 * they open inside the file-explorer panel instead of the default handler.
 *
 * Returns `true` if the event was intercepted, `false` otherwise.
 */
export function interceptFileLinks(
  event: MouseEvent,
  openFile: (path: string) => void,
): boolean {
  const target = event.target as Element | null
  if (!target) return false

  // 1) Tool-row file link: <button class="…_fileLink…">
  const fileLink = target.closest('button[class*="_fileLink"]')
  if (fileLink instanceof HTMLButtonElement) {
    const path = fileLink.textContent?.trim()
    if (path) {
      event.preventDefault()
      event.stopImmediatePropagation()
      openFile(path)
      return true
    }
  }

  // 2) Produced-file chip: <div data-produced-files-row>…<button class="…_file…">
  const chip = target.closest('[data-produced-files-row] button[class*="_file"]')
  if (chip instanceof HTMLButtonElement) {
    const path = chip.getAttribute('title')?.trim()
    if (path) {
      event.preventDefault()
      event.stopImmediatePropagation()
      openFile(path)
      return true
    }
  }

  return false
}