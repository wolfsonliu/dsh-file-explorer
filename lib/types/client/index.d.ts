import React from 'react';
import { type FileExplorerPanelHandle } from './panel.tsx';
interface ClientContext {
    sessions: {
        list: {
            getSnapshot(): {
                current?: string;
                byId: Record<string, {
                    id: string;
                    cwd?: string;
                }>;
            };
        };
    };
    workspaces: {
        openPath(path: string): Promise<void>;
    };
    effect(callback: () => (() => void), label?: string): void;
}
export declare const inject: string[];
interface FileExplorerAppProps {
    sessionId: string | undefined;
    panelRef: React.RefObject<FileExplorerPanelHandle>;
}
export declare function FileExplorerApp({ sessionId, panelRef }: FileExplorerAppProps): React.FunctionComponentElement<{
    children?: React.ReactNode | undefined;
}>;
export declare function apply(ctx: ClientContext): void;
export {};
