/** Panel styles injected as a <style> tag (an external plugin cannot import a CSS module). */
export const PANEL_CSS = `
.dsh-fe-panel {
  --fe-bg: var(--dsw-alias-bg-base, #fff);
  --fe-border: var(--dsw-alias-border-l2, #0000001a);
  --fe-title-bg: var(--dsw-alias-bg-layer-1, #f5f5f5);
  --fe-title-fg: var(--dsw-alias-label-primary, #333);
  --fe-divider: var(--dsw-alias-border-l2, #0000001a);
  --fe-btn-hover: var(--dsw-alias-interactive-bg-hover, #0000000d);
  background: var(--fe-bg);
  position: fixed;
  z-index: 1000;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--fe-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  color: var(--fe-title-fg);
}
.dsh-fe-panel[data-maximized='true'] { border-radius: 0; box-shadow: none; }
.dsh-fe-title-bar {
  display: flex;
  align-items: center;
  background: var(--fe-title-bg);
  padding: 0 8px;
  height: 32px;
  min-height: 32px;
  cursor: grab;
  user-select: none;
  touch-action: none;
  border-bottom: 1px solid var(--fe-border);
  flex-shrink: 0;
}
.dsh-fe-title-bar:active { cursor: grabbing; }
.dsh-fe-title-text {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  padding-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-fe-title-actions { display: flex; gap: 2px; margin-left: auto; }
.dsh-fe-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: var(--fe-title-fg);
  padding: 0;
}
.dsh-fe-btn:hover { background: var(--fe-btn-hover); }
.dsh-fe-body { flex: 1; min-height: 0; overflow: auto; }
.dsh-fe-pane { overflow: auto; min-width: 0; }
.dsh-fe-pane--tree { flex-shrink: 0; border-right: none; }
.dsh-fe-pane--preview { flex: 1; }
.dsh-fe-divider {
  width: 4px;
  cursor: col-resize;
  background: var(--fe-divider);
  flex-shrink: 0;
  transition: background 0.15s;
}
.dsh-fe-divider:hover, .dsh-fe-divider:active { background: var(--dsw-alias-state-business-primary, #4a90d9); }
.dsh-fe-tree-empty, .dsh-fe-placeholder {
  padding: 16px;
  color: var(--dsw-alias-label-tertiary, #777);
}
.dsh-fe-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-fe-row:hover { background: var(--fe-btn-hover); }
.dsh-fe-row--dir { font-weight: 500; }
.dsh-fe-disclosure { width: 12px; flex-shrink: 0; color: var(--dsw-alias-label-secondary, #999); }
.dsh-fe-file-icon { flex-shrink: 0; color: var(--dsw-alias-label-secondary, #999); }
.dsh-fe-row-name { overflow: hidden; text-overflow: ellipsis; }
.dsh-fe-toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--fe-border); }
.dsh-fe-refresh { border: none; background: transparent; cursor: pointer; font-size: 14px; color: var(--fe-title-fg); }
.dsh-fe-children { padding-left: 14px; }
.dsh-fe-menu {
  position: fixed;
  z-index: 1001;
  min-width: 160px;
  padding: 4px;
  border: 1px solid var(--fe-border);
  border-radius: 8px;
  background: var(--fe-bg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}
.dsh-fe-menu-item {
  display: flex;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  color: var(--fe-title-fg);
  font-size: 13px;
}
.dsh-fe-menu-item:hover { background: var(--fe-btn-hover); }
.dsh-fe-preview-content { padding: 12px; }
.dsh-fe-code {
  margin: 0;
  white-space: pre;
  tab-size: 2;
  font: 13px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
  overflow: auto;
}
.dsh-fe-image { max-width: 100%; max-height: 100%; }
.dsh-fe-drawer { position: fixed; left: 0; top: 0; bottom: 0; width: 280px; z-index: 999; display: flex; flex-direction: column; background: var(--dsw-alias-bg-base, #fff); border-right: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.1)); box-shadow: 4px 0 16px rgba(0,0,0,0.12); }
.dsh-fe-drawer-title { display: flex; align-items: center; height: 36px; padding: 0 8px; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.1)); flex-shrink: 0; color: var(--dsw-alias-label-primary, #333); }
.dsh-fe-drawer-title-text { flex: 1; font-weight: 600; font-size: 13px; }
.dsh-fe-drawer-body { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
.dsh-fe-file-button { position: fixed; left: 8px; bottom: 8px; z-index: 1000; display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.1)); border-radius: 16px; background: var(--dsw-alias-bg-base, #fff); box-shadow: 0 2px 8px rgba(0,0,0,0.16); cursor: pointer; font-size: 13px; color: var(--dsw-alias-label-primary, #333); }
`;
