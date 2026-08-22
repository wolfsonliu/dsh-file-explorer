import type { ComponentType } from 'react';
import type { PreviewProps } from './registry.ts';
import { type ReadRawFile } from './text-large.tsx';
/** Build (and memoize) the built-in CSV preview for a given reader. */
export declare function makeCsvPreview(readRawFile?: ReadRawFile): ComponentType<PreviewProps>;
