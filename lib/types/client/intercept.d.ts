/**
 * Intercept click events on tool-row file links and produced-file chips so
 * they open inside the file-explorer panel instead of the default handler.
 *
 * Returns `true` if the event was intercepted, `false` otherwise.
 */
export declare function interceptFileLinks(event: MouseEvent, openFile: (path: string) => void): boolean;
