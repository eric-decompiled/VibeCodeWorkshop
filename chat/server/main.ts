import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Effect } from "effect";
import type { ViteDevServer } from "vite";
import { ChatState } from "./state.ts";
import { makeApi, type Api } from "./api.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DIST = join(ROOT, "dist");

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || randomBytes(12).toString("hex");

function parseUidFromUrl(url: string): string | null {
  const q = url.split("?")[1];
  if (!q) return null;
  for (const part of q.split("&")) {
    const [k = "", v = ""] = part.split("=");
    if (decodeURIComponent(k) === "uid") {
      const val = decodeURIComponent(v);
      return /^[\w-]{8,64}$/.test(val) ? val : null;
    }
  }
  return null;
}

function sendText(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { "content-type": "text/plain" });
  res.end(body);
}

async function serveHtmlDev(vite: ViteDevServer, name: string, urlPath: string, res: ServerResponse) {
  try {
    const raw = await readFile(join(ROOT, name), "utf8");
    const html = await vite.transformIndexHtml(urlPath, raw);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(html);
  } catch (err) {
    vite.ssrFixStacktrace(err as Error);
    console.error("dev html error", err);
    sendText(res, 500, "dev html error");
  }
}

async function serveHtmlProd(name: string, res: ServerResponse) {
  try {
    const body = await readFile(join(DIST, name));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(body);
  } catch {
    sendText(res, 404, "not found");
  }
}

function routeApi(req: IncomingMessage, res: ServerResponse, api: Api, pathname: string): boolean {
  if (req.method === "POST") {
    if (pathname === "/api/send") { api.handleSend(req, res); return true; }
    if (pathname === "/api/react") { api.handleReact(req, res); return true; }
    if (pathname === "/api/delete") { api.handleDelete(req, res); return true; }
  }
  if (req.method === "GET" && pathname === "/api/events") {
    api.handleEvents(req, res, parseUidFromUrl(req.url ?? ""));
    return true;
  }
  const adminPrefix = `/admin/${api.adminToken}`;
  if (pathname === `${adminPrefix}/events` && req.method === "GET") {
    api.handleEvents(req, res, parseUidFromUrl(req.url ?? ""));
    return true;
  }
  if (pathname === `${adminPrefix}/log` && req.method === "POST") {
    api.handleAdminLog(req, res);
    return true;
  }
  if (pathname === `${adminPrefix}/delete` && req.method === "POST") {
    api.handleAdminDelete(req, res);
    return true;
  }
  return false;
}

async function main() {
  const state = await Effect.runPromise(ChatState.make);
  const api = makeApi(state, ADMIN_TOKEN);

  let vite: ViteDevServer | null = null;
  if (!IS_PROD) {
    const { createServer } = await import("vite");
    vite = await createServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: "custom",
    });
  }

  const adminPath = `/admin/${ADMIN_TOKEN}`;

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0] ?? "/";

    if (routeApi(req, res, api, pathname)) return;

    if (pathname === adminPath || pathname === `${adminPath}/`) {
      if (req.method !== "GET") { res.writeHead(405).end(); return; }
      if (IS_PROD) serveHtmlProd("admin.html", res);
      else serveHtmlDev(vite!, "admin.html", "/admin.html", res);
      return;
    }

    if (pathname.startsWith("/admin/")) {
      sendText(res, 403, "forbidden");
      return;
    }

    if (IS_PROD) {
      serveProdAsset(pathname, res);
    } else {
      vite!.middlewares(req, res, () => {
        serveHtmlDev(vite!, "index.html", "/", res);
      });
    }
  });

  server.listen(PORT, () => {
    const base = `http://localhost:${PORT}`;
    console.log(`[chat] ${IS_PROD ? "prod" : "dev"} listening on ${base}`);
    console.log(`[chat] students: ${base}/`);
    console.log(`[chat] admin:    ${base}${adminPath}`);
  });
}

const MIME: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

async function serveProdAsset(pathname: string, res: ServerResponse) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const safe = rel.replace(/\.\.+/g, "");
  const full = join(DIST, safe);
  if (!full.startsWith(DIST)) { sendText(res, 403, "forbidden"); return; }
  try {
    const body = await readFile(full);
    const ext = safe.slice(safe.lastIndexOf("."));
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": safe.endsWith(".html") ? "no-store" : "public, max-age=3600",
    });
    res.end(body);
  } catch {
    if (safe !== "/index.html") {
      await serveHtmlProd("index.html", res);
    } else sendText(res, 404, "not found");
  }
}

main().catch((err) => {
  console.error("fatal", err);
  process.exit(1);
});
