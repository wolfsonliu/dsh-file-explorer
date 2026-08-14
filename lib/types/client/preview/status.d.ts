import type { ComponentType } from 'react';
import type { PreviewProps } from './registry.ts';
/** Format a byte count into a human-readable string. */
export declare function formatBytes(bytes: number): string;
export declare const StatusPreview: ComponentType<PreviewProps>;
