import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
};

/** 프로젝트 루트 안의 정적 파일만 제공하는 개발 서버를 만든다. */
export function createStaticServer(rootDirectory) {
  const root = resolve(rootDirectory);

  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      const relativePath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1);
      const filePath = resolve(root, relativePath);

      if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      const fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }

      const content = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
}

const runtimeProcess = globalThis.process;
const isDirectExecution = runtimeProcess?.argv?.[1] && fileURLToPath(import.meta.url) === resolve(runtimeProcess.argv[1]);

if (isDirectExecution) {
  const rootDirectory = resolve(fileURLToPath(new URL("../", import.meta.url)));
  const port = Number.parseInt(runtimeProcess.env.PORT ?? "4173", 10);
  const server = createStaticServer(rootDirectory);

  server.listen(port, "127.0.0.1", () => {
    console.log(`손끝의 마법사 개발 서버: http://127.0.0.1:${port}`);
  });
}
