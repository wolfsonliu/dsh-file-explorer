import type { ComponentType } from 'react';
import type { PreviewProps } from './registry.ts';
export type ReadRawFile = (path: string, offset?: number, limit?: number) => Promise<ArrayBuffer>;
/** Build (and memoize) the built-in paged text renderer for a given reader. */
export declare function makeTextPagedPreview(readRawFile?: ReadRawFile): ComponentType<PreviewProps>;
