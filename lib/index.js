import { createReadStream } from "node:fs";
import { cp, mkdir as mkdir$1, open, readFile, readdir, realpath, rename as rename$1, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
//#region lib/types/protocol.js
/** Wire protocol shared by host and browser halves. */
const FILE_EXPLORER_ROUTE = "/file-explorer/api";
/** Prefix route that serves workspace files for browser-native rendering. */
const STATIC_FILES_ROUTE = "/file-explorer/files";
//#endregion
//#region lib/types/index.js
const inject = ["webServer", "sessions"];
const IMAGE_MIME = {
	".avif": "image/avif",
	".bmp": "image/bmp",
	".gif": "image/gif",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
	".svg": "image/svg+xml"
};
/** Extensions streamed inline for the browser's native viewer (whitelist). */
const INLINE_MIME = { ".pdf": "application/pdf" };
/** Content types for the `/file-explorer/files` static prefix route. */
const STATIC_MIME = {
	".html": "text/html",
	".htm": "text/html",
	".xhtml": "application/xhtml+xml",
	".svg": "image/svg+xml",
	".pdf": "application/pdf",
	".css": "text/css",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".json": "application/json",
	".xml": "application/xml",
	".txt": "text/plain",
	".md": "text/plain",
	".csv": "text/csv",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
	".bmp": "image/bmp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".wasm": "application/wasm",
	".mp4": "video/mp4",
	".webm": "video/webm",
	".mov": "video/quicktime",
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".ogg": "audio/ogg"
};
/** Document types served with an `inline` Content-Disposition. */
const STATIC_INLINE_EXTS = /* @__PURE__ */ new Set([
	".html",
	".htm",
	".xhtml",
	".svg",
	".pdf"
]);
/** Types eligible for the optional `inlineCsp` Content-Security-Policy header. */
const STATIC_CSP_EXTS = /* @__PURE__ */ new Set([
	".html",
	".htm",
	".xhtml",
	".svg"
]);
async function inside(root, input = "", opts) {
	const resolved = resolve(root, input || ".");
	const absolute = opts?.allowMissing ? join(await realpath(dirname(resolved)), basename(resolved)) : await realpath(resolved);
	const path = relative(root, absolute);
	if (path === ".." || path.startsWith(`..${sep}`) || resolve(path) === path) throw new Error("path is outside the configured workspace");
	return {
		absolute,
		path: path.split(sep).join("/")
	};
}
const listCache = /* @__PURE__ */ new Map();
const LIST_CACHE_TTL_MS = 2e3;
/** Drop all cached directory listings (called after a write changes entry sizes). */
function invalidateListCache() {
	listCache.clear();
}
async function list(root, input, showHidden = false) {
	const target = await inside(root, input);
	const dirInfo = await stat(target.absolute);
	const cacheKey = `${root}\0${target.path}\0${showHidden}`;
	const cached = listCache.get(cacheKey);
	const now = Date.now();
	if (cached !== void 0 && cached.mtimeMs === dirInfo.mtimeMs && now < cached.expiresAt) return cached.entries;
	const children = await readdir(target.absolute, { withFileTypes: true });
	const sorted = (await Promise.all(children.filter((child) => !child.isSymbolicLink() && (showHidden || !child.name.startsWith("."))).map(async (child) => {
		const childPath = target.path === "" ? child.name : `${target.path}/${child.name}`;
		if (child.isDirectory()) return {
			name: child.name,
			path: childPath,
			kind: "directory"
		};
		const info = await stat(resolve(target.absolute, child.name));
		return {
			name: child.name,
			path: childPath,
			kind: "file",
			size: info.size
		};
	}))).sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "directory" ? -1 : 1);
	listCache.set(cacheKey, {
		mtimeMs: dirInfo.mtimeMs,
		expiresAt: now + LIST_CACHE_TTL_MS,
		entries: sorted
	});
	return sorted;
}
/** Read the first `maxBytes` bytes of a file (bounded; never reads more). */
async function readHead(absolute, maxBytes) {
	const handle = await open(absolute, "r");
	try {
		const buffer = Buffer.alloc(maxBytes);
		let offset = 0;
		while (offset < maxBytes) {
			const { bytesRead } = await handle.read(buffer, offset, maxBytes - offset, offset);
			if (bytesRead === 0) break;
			offset += bytesRead;
		}
		return buffer.subarray(0, offset);
	} finally {
		await handle.close();
	}
}
/** Build a binary preview (hexdump payload) from a byte buffer, capped to `maxBinary`. */
function binaryFrom(name, size, bytes, maxBinary) {
	return {
		kind: "binary",
		name,
		size,
		bytes: bytes.subarray(0, Math.min(maxBinary, bytes.length)).toString("base64"),
		truncated: size > maxBinary
	};
}
async function preview(root, input, maxText, maxImage, mode = "auto", maxBinary = 65536) {
	const target = await inside(root, input);
	const info = await stat(target.absolute);
	if (!info.isFile()) throw new Error("path is not a file");
	const name = target.path.split("/").at(-1) ?? target.path;
	const extension = extname(name).toLowerCase();
	if (info.size === 0) return {
		kind: "empty",
		name,
		size: 0
	};
	if (mode === "binary") {
		const head = await readHead(target.absolute, maxBinary);
		return binaryFrom(name, info.size, head, maxBinary);
	}
	if (mode === "text") {
		if (info.size > maxText) return {
			kind: "text-large",
			name,
			extension,
			size: info.size
		};
		return {
			kind: "text",
			name,
			extension,
			content: (await readFile(target.absolute)).toString("utf8"),
			size: info.size
		};
	}
	const mime = IMAGE_MIME[extension];
	if (mime) {
		if (info.size > maxImage) return {
			kind: "too-large",
			name,
			size: info.size
		};
		return {
			kind: "image",
			name,
			mime,
			dataUrl: `data:${mime};base64,${(await readFile(target.absolute)).toString("base64")}`,
			size: info.size
		};
	}
	if (info.size > maxText) {
		const head = await readHead(target.absolute, maxBinary);
		if (head.includes(0)) return binaryFrom(name, info.size, head, maxBinary);
		return {
			kind: "text-large",
			name,
			extension,
			size: info.size
		};
	}
	const body = await readFile(target.absolute);
	if (body.includes(0)) return binaryFrom(name, info.size, body, maxBinary);
	return {
		kind: "text",
		name,
		extension,
		content: body.toString("utf8"),
		size: info.size
	};
}
async function raw(root, input, maxRaw, range) {
	const target = await inside(root, input);
	const info = await stat(target.absolute);
	if (!info.isFile()) throw new Error("path is not a file");
	const offset = range?.offset ?? 0;
	const limit = range?.limit !== void 0 ? Math.min(range.limit, maxRaw) : Math.min(info.size - offset, maxRaw);
	if (limit <= 0 || offset >= info.size) throw new Error("invalid range");
	const handle = await open(target.absolute, "r");
	try {
		const buffer = Buffer.alloc(limit);
		let pos = 0;
		while (pos < limit) {
			const { bytesRead } = await handle.read(buffer, pos, limit - pos, offset + pos);
			if (bytesRead === 0) break;
			pos += bytesRead;
		}
		return {
			buffer: buffer.subarray(0, pos),
			size: info.size
		};
	} finally {
		await handle.close();
	}
}
async function write(root, input, content) {
	const target = await inside(root, input, { allowMissing: true });
	await writeFile(target.absolute, content, "utf8");
	return target.path;
}
/** Reject operating on the workspace root itself ('' or '.'). */
function assertNotRoot(input) {
	if (input === "" || input === ".") throw new Error("cannot operate on the workspace root");
}
/** Reject an empty, dot, parent, or path-separator-containing final segment. */
function assertValidName(name) {
	if (name === "" || name === "." || name === ".." || name.includes("/") || name.includes("\\")) throw new Error("invalid name");
}
/** Whether a path exists (any file type). */
async function exists(absolute) {
	try {
		await stat(absolute);
		return true;
	} catch (err) {
		if (err.code === "ENOENT") return false;
		throw err;
	}
}
/** Join a workspace-relative parent ('' = root) with a final segment. */
function joinRel(parent, name) {
	return parent === "" ? name : `${parent}/${name}`;
}
/** Reject moving/copying a directory into itself or one of its descendants. */
function assertNotDescendant(kind, destPath, sourcePath) {
	if (sourcePath === "") return;
	if (destPath === sourcePath || destPath.startsWith(`${sourcePath}/`)) throw new Error(`cannot ${kind} a directory into itself`);
}
async function createFile(root, input) {
	assertNotRoot(input);
	assertValidName(input.split("/").at(-1) ?? "");
	const target = await inside(root, input, { allowMissing: true });
	if (await exists(target.absolute)) throw new Error("path already exists");
	await writeFile(target.absolute, "", {
		encoding: "utf8",
		flag: "wx"
	});
	return target.path;
}
async function mkdir(root, input) {
	assertNotRoot(input);
	assertValidName(input.split("/").at(-1) ?? "");
	const target = await inside(root, input, { allowMissing: true });
	if (await exists(target.absolute)) throw new Error("path already exists");
	await mkdir$1(target.absolute);
	return target.path;
}
async function rename(root, input, name) {
	assertNotRoot(input);
	assertValidName(name);
	const target = await inside(root, input);
	const parent = target.path.includes("/") ? target.path.slice(0, target.path.lastIndexOf("/")) : "";
	const nextAbs = join(dirname(target.absolute), name);
	if (await exists(nextAbs)) throw new Error("target already exists");
	await rename$1(target.absolute, nextAbs);
	return joinRel(parent, name);
}
async function move(root, input, toDir) {
	assertNotRoot(input);
	const source = await inside(root, input);
	const destDir = await inside(root, toDir || ".");
	if (!(await stat(destDir.absolute)).isDirectory()) throw new Error("destination is not a directory");
	assertNotDescendant("move", destDir.path, source.path);
	const name = source.path.split("/").at(-1) ?? "";
	const nextAbs = join(destDir.absolute, name);
	if (await exists(nextAbs)) throw new Error("target already exists");
	await rename$1(source.absolute, nextAbs);
	return joinRel(destDir.path, name);
}
async function copy(root, input, toDir) {
	assertNotRoot(input);
	const source = await inside(root, input);
	const destDir = await inside(root, toDir || ".");
	if (!(await stat(destDir.absolute)).isDirectory()) throw new Error("destination is not a directory");
	assertNotDescendant("copy", destDir.path, source.path);
	const name = source.path.split("/").at(-1) ?? "";
	const nextAbs = join(destDir.absolute, name);
	if (await exists(nextAbs)) throw new Error("target already exists");
	await cp(source.absolute, nextAbs, { recursive: true });
	return joinRel(destDir.path, name);
}
async function remove(root, input) {
	assertNotRoot(input);
	const target = await inside(root, input);
	await rm(target.absolute, { recursive: true });
	return target.path;
}
/** Parse an HTTP Range header ("bytes=start-end" or "bytes=start-") into inclusive byte offsets. */
function parseRange(header) {
	if (header === void 0) return void 0;
	const match = /^bytes=(\d+)-(\d*)$/.exec(header);
	if (match === null) return void 0;
	const start = Number(match[1]);
	const endPart = match[2];
	return endPart === "" ? { start } : {
		start,
		end: Number(endPart)
	};
}
async function servePdf(root, input, rangeHeader, res) {
	const target = await inside(root, input);
	const info = await stat(target.absolute);
	if (!info.isFile()) throw new Error("path is not a file");
	const mime = INLINE_MIME[extname(target.path).toLowerCase()];
	if (mime === void 0) throw new Error("unsupported file type");
	const name = target.path.split("/").at(-1) ?? target.path;
	const range = parseRange(rangeHeader);
	if (range !== void 0) {
		if (range.start >= info.size) {
			res.writeHead(416, { "content-range": `bytes */${info.size}` });
			res.end();
			return;
		}
		const end = range.end !== void 0 ? Math.min(range.end, info.size - 1) : info.size - 1;
		if (end < range.start) {
			res.writeHead(416, { "content-range": `bytes */${info.size}` });
			res.end();
			return;
		}
		res.writeHead(206, {
			"content-type": mime,
			"content-disposition": `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
			"content-range": `bytes ${range.start}-${end}/${info.size}`,
			"content-length": String(end - range.start + 1),
			"accept-ranges": "bytes",
			"cache-control": "no-store",
			"x-content-type-options": "nosniff"
		});
		const stream = createReadStream(target.absolute, {
			start: range.start,
			end
		});
		stream.on("error", () => res.destroy());
		stream.pipe(res);
		return;
	}
	res.writeHead(200, {
		"content-type": mime,
		"content-disposition": `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
		"accept-ranges": "bytes",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	const stream = createReadStream(target.absolute);
	stream.on("error", () => res.destroy());
	stream.pipe(res);
}
/** Build the common response headers for the static route. */
function staticHeaders(mime, ext, name, csp, extra) {
	const headers = {
		"content-type": mime,
		"accept-ranges": "bytes",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff",
		...extra
	};
	if (STATIC_INLINE_EXTS.has(ext)) headers["content-disposition"] = `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;
	if (csp !== void 0 && csp !== "" && STATIC_CSP_EXTS.has(ext)) headers["content-security-policy"] = csp;
	return headers;
}
/** Stream one file (with Range support) using static-route headers. */
async function streamStatic(absolute, filePath, info, rangeHeader, csp, res) {
	const ext = extname(filePath).toLowerCase();
	const mime = STATIC_MIME[ext] ?? "application/octet-stream";
	const name = filePath.split("/").at(-1) ?? filePath;
	const range = parseRange(rangeHeader);
	if (range !== void 0) {
		if (range.start >= info.size) {
			res.writeHead(416, { "content-range": `bytes */${info.size}` });
			res.end();
			return;
		}
		const end = range.end !== void 0 ? Math.min(range.end, info.size - 1) : info.size - 1;
		if (end < range.start) {
			res.writeHead(416, { "content-range": `bytes */${info.size}` });
			res.end();
			return;
		}
		res.writeHead(206, staticHeaders(mime, ext, name, csp, {
			"content-range": `bytes ${range.start}-${end}/${info.size}`,
			"content-length": String(end - range.start + 1)
		}));
		const stream = createReadStream(absolute, {
			start: range.start,
			end
		});
		stream.on("error", () => res.destroy());
		stream.pipe(res);
		return;
	}
	res.writeHead(200, staticHeaders(mime, ext, name, csp, {}));
	const stream = createReadStream(absolute);
	stream.on("error", () => res.destroy());
	stream.pipe(res);
}
/**
* Serve one workspace file under the static prefix route. Directories fall
* back to their `index.html`. Throws the `inside` containment error for
* escapes, ENOENT for missing files — the route handler maps those to 400/404.
*/
async function serveStatic(root, input, rangeHeader, csp, res) {
	let resolved = await inside(root, input);
	let info = await stat(resolved.absolute);
	if (info.isDirectory()) {
		resolved = await inside(root, resolved.path === "" ? "index.html" : `${resolved.path}/index.html`);
		info = await stat(resolved.absolute);
	}
	if (!info.isFile()) throw new Error("path is not a file");
	await streamStatic(resolved.absolute, resolved.path, info, rangeHeader, csp, res);
}
/** Parse `/file-explorer/files/<sessionId>/<relative/path…>` from a pathname. */
function parseStaticPath(pathname) {
	if (pathname === "/file-explorer/files" || pathname === `/file-explorer/files/`) return { error: "sessionId is required" };
	const segments = pathname.slice(20).split("/").filter((segment) => segment !== "");
	if (segments.length === 0) return { error: "sessionId is required" };
	let sessionId;
	let decoded;
	try {
		sessionId = decodeURIComponent(segments[0]);
		decoded = segments.slice(1).map((segment) => decodeURIComponent(segment));
	} catch {
		return { error: "invalid path encoding" };
	}
	for (const segment of decoded) if (segment === ".." || segment.includes("/") || segment.includes("\\")) return { error: "invalid path" };
	return {
		sessionId,
		relPath: decoded.join("/")
	};
}
function json(res, status, body) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(body));
}
async function requestBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += value.length;
		if (size > 3145728) throw new Error("request body is too large");
		chunks.push(value);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function capBytes(value, fallback) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
function apply(ctx, config = {}) {
	const maxText = capBytes(config.maxTextBytes, 2097152);
	const maxImage = capBytes(config.maxImageBytes, 10485760);
	const maxBinary = capBytes(config.maxBinaryBytes, 65536);
	const maxRaw = capBytes(config.maxRawBytes, 104857600);
	const showHidden = config.showHidden === true;
	const inlineCsp = typeof config.inlineCsp === "string" && config.inlineCsp.trim() !== "" ? config.inlineCsp : void 0;
	ctx.effect(() => {
		const disposeApiRoute = ctx.webServer.register({
			kind: "exact",
			path: FILE_EXPLORER_ROUTE,
			handler: async (req, res) => {
				try {
					const url = new URL(req.url ?? "/file-explorer/api", "http://localhost");
					const body = req.method === "POST" ? await requestBody(req) : {};
					const sessionId = typeof body.sessionId === "string" ? body.sessionId : url.searchParams.get("sessionId");
					if (sessionId === null || sessionId === "") throw new Error("sessionId is required");
					const cwd = ctx.sessions.get(sessionId)?.header.cwd;
					if (cwd === void 0) throw new Error("current session has no workspace");
					const root = resolve(cwd);
					const path = typeof body.path === "string" ? body.path : url.searchParams.get("path") ?? "";
					const action = typeof body.action === "string" ? body.action : url.searchParams.get("action") ?? "list";
					if (action === "list") return json(res, 200, {
						ok: true,
						root,
						entries: await list(root, path, showHidden)
					});
					if (action === "preview") {
						const mode = typeof body.mode === "string" ? body.mode : url.searchParams.get("mode") ?? "auto";
						if (mode !== "auto" && mode !== "text" && mode !== "binary") return json(res, 400, {
							ok: false,
							error: "unknown mode"
						});
						return json(res, 200, {
							ok: true,
							preview: await preview(root, path, maxText, maxImage, mode, maxBinary)
						});
					}
					if (action === "resolve-path") {
						const target = await inside(root, path);
						return json(res, 200, {
							ok: true,
							path: target.absolute,
							parentPath: dirname(target.absolute)
						});
					}
					if (action === "pdf") return await servePdf(root, path, req.headers.range, res);
					if (action === "raw") {
						const parsed = parseRange(req.headers.range);
						let range;
						if (parsed) range = parsed.end !== void 0 ? {
							offset: parsed.start,
							limit: parsed.end - parsed.start + 1
						} : { offset: parsed.start };
						try {
							const { buffer, size } = await raw(root, path, maxRaw, range);
							if (range) {
								const end = range.offset + buffer.length - 1;
								res.writeHead(206, {
									"content-type": "application/octet-stream",
									"content-length": String(buffer.length),
									"content-range": `bytes ${range.offset}-${end}/${size}`,
									"accept-ranges": "bytes",
									"cache-control": "no-store",
									"x-content-type-options": "nosniff"
								});
							} else res.writeHead(200, {
								"content-type": "application/octet-stream",
								"content-length": String(buffer.length),
								"accept-ranges": "bytes",
								"cache-control": "no-store",
								"x-content-type-options": "nosniff"
							});
							res.end(buffer);
							return;
						} catch (err) {
							if (err instanceof Error && err.message === "invalid range") {
								res.writeHead(416, { "content-range": `bytes */${(await stat(resolve(root, path))).size}` });
								res.end();
								return;
							}
							throw err;
						}
					}
					if (action === "write") {
						if (typeof body.content !== "string") throw new Error("content is required");
						const saved = await write(root, path, body.content);
						invalidateListCache();
						return json(res, 200, {
							ok: true,
							saved
						});
					}
					if (action === "create-file" || action === "mkdir" || action === "rename" || action === "move" || action === "copy" || action === "delete") {
						if (req.method !== "POST") throw new Error("method not allowed");
					}
					if (action === "create-file") {
						const created = await createFile(root, path);
						invalidateListCache();
						return json(res, 200, {
							ok: true,
							path: created
						});
					}
					if (action === "mkdir") {
						const created = await mkdir(root, path);
						invalidateListCache();
						return json(res, 200, {
							ok: true,
							path: created
						});
					}
					if (action === "rename") {
						if (typeof body.name !== "string") throw new Error("name is required");
						const renamed = await rename(root, path, body.name);
						invalidateListCache();
						return json(res, 200, {
							ok: true,
							path: renamed
						});
					}
					if (action === "move") {
						const moved = await move(root, path, typeof body.toDir === "string" ? body.toDir : "");
						invalidateListCache();
						return json(res, 200, {
							ok: true,
							path: moved
						});
					}
					if (action === "copy") {
						const copied = await copy(root, path, typeof body.toDir === "string" ? body.toDir : "");
						invalidateListCache();
						return json(res, 200, {
							ok: true,
							path: copied
						});
					}
					if (action === "delete") {
						const removed = await remove(root, path);
						invalidateListCache();
						return json(res, 200, {
							ok: true,
							path: removed
						});
					}
					return json(res, 400, {
						ok: false,
						error: "unknown action"
					});
				} catch (error) {
					json(res, 400, {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
		});
		const disposeStaticRoute = ctx.webServer.register({
			kind: "prefix",
			path: STATIC_FILES_ROUTE,
			handler: async (req, res) => {
				try {
					const parsed = parseStaticPath(new URL(req.url ?? "/file-explorer/files", "http://localhost").pathname);
					if ("error" in parsed) return json(res, 400, {
						ok: false,
						error: parsed.error
					});
					const cwd = ctx.sessions.get(parsed.sessionId)?.header.cwd;
					if (cwd === void 0) throw new Error("current session has no workspace");
					return await serveStatic(resolve(cwd), parsed.relPath, req.headers.range, inlineCsp, res);
				} catch (error) {
					json(res, (error instanceof Error ? error.code : void 0) === "ENOENT" ? 404 : 400, {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
		});
		return () => {
			disposeApiRoute();
			disposeStaticRoute();
		};
	}, "file-explorer: workspace file API");
}
//#endregion
export { apply, capBytes, copy, createFile, inject, inside, invalidateListCache, list, mkdir, move, preview, raw, remove, rename, serveStatic, write };
