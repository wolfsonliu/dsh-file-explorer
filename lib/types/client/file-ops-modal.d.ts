import type { BrowserEntry } from '../protocol.ts';
import type { Translate } from './locale.ts';
import { type FileOp, type FileOps } from './file-ops.ts';
export interface FileOpsModalProps {
    op: FileOp;
    fileOps: FileOps;
    fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>;
    sessionId: string | undefined;
    t: Translate;
    /** Called after a successful operation with the resulting workspace-relative path. */
    onDone: (path: string) => void;
    onCancel: () => void;
}
export declare function FileOpsModal({ op, fileOps, fetchList, sessionId, t, onDone, onCancel }: FileOpsModalProps): import("react").JSX.Element;
