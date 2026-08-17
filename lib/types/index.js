import { createReadStream } from 'node:fs';
import { open, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { FILE_EXPLORER_ROUTE, PDF_ACTION, } from "./protocol.js";
// ---------------------------------------------------------------------------
// Dependencies injected by Cordis
// ---------------------------------------------------------------------------
export const inject = ['webServer', 'sessions'];
// ---------------------------------------------------------------------------
// Image MIME map
// ---------------------------------------------------------------------------
const IMAGE_MIME = {
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
};
/** Extensions streamed inline for the browser's native viewer (whitelist). */
const INLINE_MIME = {
    '.pdf': 'application/pdf',
};
// ---------------------------------------------------------------------------
// inside — resolve a workspace-relative input to an absolute path, rejecting
// any path that escapes the workspace.
// ---------------------------------------------------------------------------
async function inside(root, input = '', opts) {
    const resolved = resolve(root, input || '.');
    // realpath resolves symlinks but requires the path to exist. A write may
    // target a new file, so with allowMissing we resolve only the parent (which
    // must exist) and keep the final component literal.
    const absolute = opts?.allowMissing
        ? join(await realpath(dirname(resolved)), basename(resolved))
        : await realpath(resolved);
    const path = relative(root, absolute);
    if (path === '..' || path.startsWith(`..${sep}`) || resolve(path) === path) {
        throw new Error('path is outside the configured workspace');
    }
    return { absolute, path: path.split(sep).join('/') };
}
// ---------------------------------------------------------------------------
// list — list one directory level; directories before files, each
// alphabetically by name; skip symlinks and hidden entries.
// ---------------------------------------------------------------------------
async function list(root, input) {
    const target = await inside(root, input);
    const children = await readdir(target.absolute, { withFileTypes: true });
    const entries = await Promise.all(children
        .filter(child => !child.isSymbolicLink())
        .map(async (child) => {
        const childPath = target.path === '' ? child.name : `${target.path}/${child.name}`;
        if (child.isDirectory()) {
            return { name: child.name, path: childPath, kind: 'directory' };
        }
        const info = await stat(resolve(target.absolute, child.name));
        return { name: child.name, path: childPath, kind: 'file', size: info.size };
    }));
    return entries.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1);
}
/** Read the first `maxBytes` bytes of a file (bounded; never reads more). */
async function readHead(absolute, maxBytes) {
    const handle = await open(absolute, 'r');
    try {
        const buffer = Buffer.alloc(maxBytes);
        // A single read may return fewer bytes than requested (short read), so loop
        // until the buffer is full or EOF (bytesRead === 0).
        let offset = 0;
        while (offset < maxBytes) {
            const { bytesRead } = await handle.read(buffer, offset, maxBytes - offset, offset);
            if (bytesRead === 0)
                break;
            offset += bytesRead;
        }
        return buffer.subarray(0, offset);
    }
    finally {
        await handle.close();
    }
}
/** Build a binary preview (hexdump payload) from a byte buffer, capped to `maxBinary`. */
function binaryFrom(name, size, bytes, maxBinary) {
    const head = bytes.subarray(0, Math.min(maxBinary, bytes.length));
    return {
        kind: 'binary',
        name,
        size,
        bytes: head.toString('base64'),
        truncated: size > maxBinary,
    };
}
// ---------------------------------------------------------------------------
// preview — read one file and return a discriminated preview.
// ---------------------------------------------------------------------------
async function preview(root, input, maxText, maxImage, mode = 'auto', maxBinary = 64 * 1024) {
    const target = await inside(root, input);
    const info = await stat(target.absolute);
    if (!info.isFile())
        throw new Error('path is not a file');
    const name = target.path.split('/').at(-1) ?? target.path;
    const extension = extname(name).toLowerCase();
    if (info.size === 0)
        return { kind: 'empty', name, size: 0 };
    if (mode === 'binary') {
        const head = await readHead(target.absolute, maxBinary);
        return binaryFrom(name, info.size, head, maxBinary);
    }
    if (mode === 'text') {
        if (info.size > maxText)
            return { kind: 'too-large', name, size: info.size };
        const body = await readFile(target.absolute);
        return { kind: 'text', name, extension, content: body.toString('utf8'), size: info.size };
    }
    const mime = IMAGE_MIME[extension];
    if (mime) {
        if (info.size > maxImage)
            return { kind: 'too-large', name, size: info.size };
        const body = await readFile(target.absolute);
        return { kind: 'image', name, mime, dataUrl: `data:${mime};base64,${body.toString('base64')}`, size: info.size };
    }
    if (info.size > maxText) {
        const head = await readHead(target.absolute, maxBinary);
        if (head.includes(0))
            return binaryFrom(name, info.size, head, maxBinary);
        return { kind: 'too-large', name, size: info.size };
    }
    const body = await readFile(target.absolute);
    if (body.includes(0))
        return binaryFrom(name, info.size, body, maxBinary);
    return { kind: 'text', name, extension, content: body.toString('utf8'), size: info.size };
}
// ---------------------------------------------------------------------------
// raw — read a file as raw bytes, with optional Range support.
// ---------------------------------------------------------------------------
async function raw(root, input, maxRaw, range) {
    const target = await inside(root, input);
    const info = await stat(target.absolute);
    if (!info.isFile())
        throw new Error('path is not a file');
    const offset = range?.offset ?? 0;
    const limit = range?.limit !== undefined
        ? Math.min(range.limit, maxRaw)
        : Math.min(info.size - offset, maxRaw);
    if (limit <= 0 || offset >= info.size)
        throw new Error('invalid range');
    const handle = await open(target.absolute, 'r');
    try {
        const buffer = Buffer.alloc(limit);
        let pos = 0;
        while (pos < limit) {
            const { bytesRead } = await handle.read(buffer, pos, limit - pos, offset + pos);
            if (bytesRead === 0)
                break;
            pos += bytesRead;
        }
        return { buffer: buffer.subarray(0, pos), size: info.size };
    }
    finally {
        await handle.close();
    }
}
// ---------------------------------------------------------------------------
// write — write UTF-8 text to a workspace file, rejecting escapes.
// ---------------------------------------------------------------------------
async function write(root, input, content) {
    const target = await inside(root, input, { allowMissing: true });
    await writeFile(target.absolute, content, 'utf8');
    return target.path;
}
// ---------------------------------------------------------------------------
// servePdf — stream one inline-capable file (whitelisted MIME) to the response.
// All validation runs before writeHead so a rejection can still send JSON.
// ---------------------------------------------------------------------------
async function servePdf(root, input, res) {
    const target = await inside(root, input);
    const info = await stat(target.absolute);
    if (!info.isFile())
        throw new Error('path is not a file');
    const mime = INLINE_MIME[extname(target.path).toLowerCase()];
    if (mime === undefined)
        throw new Error('unsupported file type');
    const name = target.path.split('/').at(-1) ?? target.path;
    res.writeHead(200, {
        'content-type': mime,
        'content-disposition': `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
    });
    const stream = createReadStream(target.absolute);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
}
// ---------------------------------------------------------------------------
// json — send a JSON response.
// ---------------------------------------------------------------------------
function json(res, status, body) {
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
    });
    res.end(JSON.stringify(body));
}
// ---------------------------------------------------------------------------
// requestBody — read a JSON request body (bounded).
// ---------------------------------------------------------------------------
async function requestBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += value.length;
        if (size > 3 * 1024 * 1024)
            throw new Error('request body is too large');
        chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
// ---------------------------------------------------------------------------
// capBytes — normalize a byte cap to a positive integer, falling back to a
// default when the configured value is missing or invalid.
// ---------------------------------------------------------------------------
function capBytes(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
// ---------------------------------------------------------------------------
// apply — register the HTTP route.
// ---------------------------------------------------------------------------
export function apply(ctx, config = {}) {
    const maxText = capBytes(config.maxTextBytes, 2 * 1024 * 1024);
    const maxImage = capBytes(config.maxImageBytes, 10 * 1024 * 1024);
    const maxBinary = capBytes(config.maxBinaryBytes, 64 * 1024);
    const maxRaw = capBytes(config.maxRawBytes, 100 * 1024 * 1024);
    ctx.effect(() => {
        const disposeRoute = ctx.webServer.register({
            kind: 'exact',
            path: FILE_EXPLORER_ROUTE,
            handler: async (req, res) => {
                try {
                    const url = new URL(req.url ?? FILE_EXPLORER_ROUTE, 'http://localhost');
                    const body = req.method === 'POST' ? await requestBody(req) : {};
                    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : url.searchParams.get('sessionId');
                    if (sessionId === null || sessionId === '')
                        throw new Error('sessionId is required');
                    const session = ctx.sessions.get(sessionId);
                    const cwd = session?.header.cwd;
                    if (cwd === undefined)
                        throw new Error('current session has no workspace');
                    const root = resolve(cwd);
                    const path = typeof body.path === 'string' ? body.path : url.searchParams.get('path') ?? '';
                    const action = typeof body.action === 'string' ? body.action : url.searchParams.get('action') ?? 'list';
                    if (action === 'list')
                        return json(res, 200, { ok: true, root, entries: await list(root, path) });
                    if (action === 'preview') {
                        const mode = typeof body.mode === 'string' ? body.mode : url.searchParams.get('mode') ?? 'auto';
                        if (mode !== 'auto' && mode !== 'text' && mode !== 'binary') {
                            return json(res, 400, { ok: false, error: 'unknown mode' });
                        }
                        return json(res, 200, { ok: true, preview: await preview(root, path, maxText, maxImage, mode, maxBinary) });
                    }
                    if (action === 'resolve-path') {
                        const target = await inside(root, path);
                        return json(res, 200, {
                            ok: true,
                            path: target.absolute,
                            parentPath: dirname(target.absolute),
                        });
                    }
                    if (action === PDF_ACTION) {
                        return await servePdf(root, path, res);
                    }
                    if (action === 'raw') {
                        const rangeHeader = req.headers.range;
                        let range;
                        if (rangeHeader) {
                            const m = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
                            if (m) {
                                const start = Number(m[1]);
                                const end = m[2] ? Number(m[2]) : undefined;
                                range = end !== undefined
                                    ? { offset: start, limit: end - start + 1 }
                                    : { offset: start };
                            }
                        }
                        try {
                            const { buffer, size } = await raw(root, path, maxRaw, range);
                            if (range) {
                                const end = range.offset + buffer.length - 1;
                                res.writeHead(206, {
                                    'content-type': 'application/octet-stream',
                                    'content-length': String(buffer.length),
                                    'content-range': `bytes ${range.offset}-${end}/${size}`,
                                    'accept-ranges': 'bytes',
                                    'cache-control': 'no-store',
                                    'x-content-type-options': 'nosniff',
                                });
                            }
                            else {
                                res.writeHead(200, {
                                    'content-type': 'application/octet-stream',
                                    'content-length': String(buffer.length),
                                    'accept-ranges': 'bytes',
                                    'cache-control': 'no-store',
                                    'x-content-type-options': 'nosniff',
                                });
                            }
                            res.end(buffer);
                            return;
                        }
                        catch (err) {
                            // Ignore: raw() throws 'invalid range' for out-of-bounds; return 416.
                            if (err instanceof Error && err.message === 'invalid range') {
                                res.writeHead(416, { 'content-range': `bytes */${(await stat(resolve(root, path))).size}` });
                                res.end();
                                return;
                            }
                            throw err;
                        }
                    }
                    if (action === 'write') {
                        if (typeof body.content !== 'string')
                            throw new Error('content is required');
                        const saved = await write(root, path, body.content);
                        return json(res, 200, { ok: true, saved });
                    }
                    return json(res, 400, { ok: false, error: 'unknown action' });
                }
                catch (error) {
                    json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
                }
            },
        });
        return () => {
            disposeRoute();
        };
    }, 'file-explorer: workspace file API');
}
// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------
export { capBytes, inside, list, preview, raw, write };
