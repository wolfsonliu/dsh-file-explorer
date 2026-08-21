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
  z-index: 10000;
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
/* height: 32px must stay in sync with TITLE_BAR_HEIGHT in src/client/panel.tsx. */
.dsh-fe-title-bar {
  display: flex;
  align-items: center;
  background: var(--fe-title-bg);
  padding: 0 8px;
  height: 32px;
  min-height: 32px;
  user-select: none;
  border-bottom: 1px solid var(--fe-border);
  flex-shrink: 0;
}
.dsh-fe-title-text {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  padding-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: grab;
  touch-action: none;
  user-select: none;
  align-self: stretch;
  display: flex;
  align-items: center;
}
.dsh-fe-title-text:active { cursor: grabbing; }
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
.dsh-fe-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; touch-action: none; }
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
.dsh-fe-tree { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; padding: 4px 0; }
.dsh-fe-virtual-list { flex: 1; min-height: 0; overflow-y: auto; position: relative; }
.dsh-fe-tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  border-radius: 8px;
  padding: 0 8px;
  cursor: pointer;
  user-select: none;
  color: var(--dsw-alias-label-primary, #333);
  box-sizing: border-box;
}
.dsh-fe-tree-row:hover { background: var(--dsw-alias-interactive-bg-hover, #0000000d); }
.dsh-fe-disclosure {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-secondary, #999);
}
.dsh-fe-spacer { width: 16px; flex-shrink: 0; }
.dsh-fe-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-secondary, #999);
}
.dsh-fe-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 20px;
}
.dsh-fe-row-actions {
  flex-shrink: 0;
  display: inline-flex;
  opacity: 0;
}
.dsh-fe-tree-row:hover .dsh-fe-row-actions { opacity: 1; }
.dsh-fe-row-action-btn {
  width: 20px;
  height: 20px;
  color: var(--dsw-alias-label-secondary, #999);
}
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
.dsh-fe-menu-item--danger { color: var(--dsw-alias-state-danger, #c0392b); }
.dsh-fe-preview-content { padding: 12px; }
.dsh-fe-code {
  margin: 0;
  padding: 16px;
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
.dsh-fe-drawer-resize { position: absolute; right: 0; top: 0; bottom: 0; width: 4px; cursor: col-resize; touch-action: none; }
.dsh-fe-drawer-resize:hover, .dsh-fe-drawer-resize:active { background: var(--dsw-alias-state-business-primary, #4a90d9); }
.dsh-fe-file-button { position: fixed; left: 0; z-index: 1000; display: inline-flex; align-items: center; gap: 4px; height: 36px; width: 36px; padding: 0 8px; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.1)); border-left: none; border-radius: 0 18px 18px 0; background: var(--dsw-alias-button-elevated-fill, var(--dsw-alias-bg-base, #fff)); box-shadow: 2px 0 8px rgba(0,0,0,0.12); cursor: grab; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary, #333); overflow: hidden; white-space: nowrap; transition: width 0.15s ease, background 0.15s ease; touch-action: none; }
.dsh-fe-file-button:active { cursor: grabbing; }
.dsh-fe-file-button:hover { width: 80px; background: var(--dsw-alias-button-floating-hover, var(--dsw-alias-interactive-bg-hover, #0000000d)); }
.dsh-fe-file-button-icon { display: inline-flex; flex-shrink: 0; }
.dsh-fe-file-button-label { opacity: 0; transition: opacity 0.15s ease; }
.dsh-fe-file-button:hover .dsh-fe-file-button-label { opacity: 1; }
.dsh-fe-md { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.dsh-fe-md-toolbar { display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid var(--fe-border); flex-shrink: 0; }
.dsh-fe-md-btn {
  border: 1px solid var(--fe-border);
  background: var(--fe-bg);
  border-radius: 4px;
  padding: 2px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--fe-title-fg);
}
.dsh-fe-md-btn:hover { background: var(--fe-btn-hover); }
.dsh-fe-md-btn:disabled { opacity: 0.5; cursor: default; }
.dsh-fe-md-editor {
  flex: 1;
  min-height: 0;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  font: 13px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
  background: var(--fe-bg);
  color: var(--fe-title-fg);
}
.dsh-fe-md-error { padding: 8px 12px; color: var(--dsw-alias-state-danger, #c0392b); font-size: 13px; }
.dsh-fe-md-content {
  padding: 20px 24px;
  line-height: 1.7;
  max-width: 44em;
  overflow-wrap: break-word;
}
.dsh-fe-md-content > :first-child { margin-top: 0; }
.dsh-fe-md-content > :last-child { margin-bottom: 0; }
.dsh-fe-md-content h1, .dsh-fe-md-content h2, .dsh-fe-md-content h3,
.dsh-fe-md-content h4, .dsh-fe-md-content h5, .dsh-fe-md-content h6 {
  margin: 1.2em 0 0.5em;
  line-height: 1.3;
}
.dsh-fe-md-content p, .dsh-fe-md-content ul, .dsh-fe-md-content ol { margin: 0.7em 0; }
.dsh-fe-md-content pre {
  background: var(--dsw-alias-bg-layer-1, #f5f5f5);
  padding: 10px 12px;
  border-radius: 6px;
  overflow: auto;
}
.dsh-fe-md-content code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.92em;
}
.dsh-fe-md-content pre code { background: none; padding: 0; font-size: 1em; }
.dsh-fe-md-content blockquote {
  margin: 0.7em 0;
  padding: 2px 12px;
  border-left: 3px solid var(--fe-border, rgba(0,0,0,0.1));
  color: var(--dsw-alias-label-secondary, #777);
}
.dsh-fe-md-content img { max-width: 100%; }
.dsh-fe-md-content table { border-collapse: collapse; }
.dsh-fe-md-content th, .dsh-fe-md-content td {
  border: 1px solid var(--fe-border, rgba(0,0,0,0.1));
  padding: 6px 10px;
}
.dsh-fe-hex { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.dsh-fe-hex-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--fe-border);
  color: var(--dsw-alias-label-secondary, #999);
  font-size: 12px;
  flex-shrink: 0;
}
.dsh-fe-hex .dsh-fe-code { flex: 1; min-height: 0; }
.dsh-fe-text-large { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.dsh-fe-text-large-meta { display: flex; align-items: center; gap: 8px; padding: 4px 8px 8px; flex-shrink: 0; color: var(--dsw-alias-label-secondary, #999); font-size: 12px; }
.dsh-fe-text-large-body { flex: 1; min-height: 0; overflow: auto; }
.dsh-fe-text-large-body .dsh-fe-code { margin: 0; }
.dsh-fe-preview-error { padding: 0 8px 8px; color: var(--dsw-alias-state-danger, #c0392b); font-size: 13px; }
.dsh-fe-search-bar { display: flex; align-items: center; gap: 4px; padding: 2px 8px; flex-shrink: 0; color: var(--dsw-alias-label-secondary, #999); }
.dsh-fe-search { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--dsw-alias-label-primary, #333); font-size: 13px; line-height: 24px; }
.dsh-fe-search::placeholder { color: var(--dsw-alias-label-tertiary, #777); }
.dsh-fe-search-clear { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: transparent; border-radius: 4px; cursor: pointer; color: var(--dsw-alias-label-secondary, #999); padding: 0; }
.dsh-fe-search-clear:hover { background: var(--dsw-alias-interactive-bg-hover, #0000000d); }
.dsh-fe-search-result { display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; border-radius: 8px; cursor: pointer; user-select: none; color: var(--dsw-alias-label-primary, #333); box-sizing: border-box; }
.dsh-fe-search-result:hover { background: var(--dsw-alias-interactive-bg-hover, #0000000d); }
.dsh-fe-path-hint { margin-left: auto; flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary, #777); font-size: 11px; }
`
