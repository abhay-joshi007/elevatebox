import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".css", "text/css; charset=utf-8"]
]);

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export async function parseRequest(req) {
  const rawBody = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  const parsedUrl = new URL(req.url, "http://localhost");
  let body = null;

  if (rawBody) {
    if (contentType.includes("application/json")) {
      body = JSON.parse(rawBody);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(rawBody).entries());
    } else {
      body = rawBody;
    }
  }

  return {
    body,
    rawBody,
    path: parsedUrl.pathname,
    query: Object.fromEntries(parsedUrl.searchParams.entries())
  };
}

export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

export function sendText(res, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(payload);
}

export function sendXml(res, payload) {
  sendText(res, 200, payload, "text/xml; charset=utf-8");
}

export function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

export function serveFile(res, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    notFound(res);
    return;
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = MIME_TYPES.get(ext) || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mimeType });
  fs.createReadStream(absolutePath).pipe(res);
}

export function safeStaticPath(rootDir, requestedPath) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedFile = path.resolve(resolvedRoot, requestedPath);
  if (resolvedFile === resolvedRoot || !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }
  return resolvedFile;
}
