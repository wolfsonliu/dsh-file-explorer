import { open, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
//#region lib/types/protocol.js
/** Wire protocol shared by host and browser halves. */
const FILE_EXPLORER_ROUTE = "/file-explorer/api";
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
async function list(root, input) {
	const target = await inside(root, input);
	const children = await readdir(target.absolute, { withFileTypes: true });
	return (await Promise.all(children.filter((child) => !child.isSymbolicLink()).map(async (child) => {
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
			kind: "too-large",
			name,
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
			kind: "too-large",
			name,
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
async function write(root, input, content) {
	const target = await inside(root, input, { allowMissing: true });
	await writeFile(target.absolute, content, "utf8");
	return target.path;
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
	ctx.effect(() => {
		const disposeRoute = ctx.webServer.register({
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
						entries: await list(root, path)
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
					if (action === "write") {
						if (typeof body.content !== "string") throw new Error("content is required");
						return json(res, 200, {
							ok: true,
							saved: await write(root, path, body.content)
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
		return () => {
			disposeRoute();
		};
	}, "file-explorer: workspace file API");
}
//#endregion
export { apply, capBytes, inject, inside, list, preview, write };
