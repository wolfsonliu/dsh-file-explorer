import type { IncomingMessage, ServerResponse } from 'node:http';
import { type BrowserEntry, type Config, type FilePreview, type PreviewMode } from './protocol.ts';
interface HostContext {
    sessions: {
        get(id: string): {
            header: {
                cwd?: string;
            };
        } | undefined;
    };
    webServer: {
        register(route: {
            kind: 'exact';
            path: string;
            handler(req: IncomingMessage, res: ServerResponse): Promise<void>;
        }): () => void;
    };
    effect(callback: () => (() => void), label?: string): void;
}
export declare const inject: string[];
declare function inside(root: string, input?: string, opts?: {
    allowMissing?: boolean;
}): Promise<{
    absolute: string;
    path: string;
}>;
declare function list(root: string, input: string): Promise<BrowserEntry[]>;
declare function preview(root: string, input: string, maxText: number, maxImage: number, mode?: PreviewMode, maxBinary?: number): Promise<FilePreview>;
declare function write(root: string, input: string, content: string): Promise<string>;
declare function capBytes(value: number | undefined, fallback: number): number;
export declare function apply(ctx: HostContext, config?: Config): void;
export { capBytes, inside, list, preview, write };
