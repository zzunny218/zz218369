import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createStaticServer } from "./dev-server.mjs";

test("개발 서버는 시작 화면을 HTTP 200으로 제공한다", async () => {
  const server = createStaticServer(resolve("."));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/`);
  const html = await response.text();
  server.close();

  assert.equal(response.status, 200);
  assert.match(html, /id="world-canvas"/);
  assert.match(html, /id="title-screen"/);
  assert.match(html, /id="game-start-button"/);
  assert.match(html, /id="rune-canvas"/);
  assert.match(html, /id="exploration-screen"/);
  assert.match(html, /게임실행\.cmd/);
});

test("개발 서버는 MP3 효과음을 audio/mpeg 형식으로 제공한다", async () => {
  const server = createStaticServer(resolve("."));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/assets/audio/magic.mp3`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("게임 실행기는 서버 응답을 확인한 뒤 설치된 Chrome을 직접 연다", async () => {
  const launcher = await readFile(resolve("게임실행.cmd"), "utf8");

  assert.match(launcher, /Invoke-WebRequest/);
  assert.match(launcher, /Google\\Chrome\\Application\\chrome\.exe/);
  assert.match(launcher, /--new-window "%GAME_URL%"/);
  assert.match(launcher, /LAUNCHER_CHECK_OK/);
});

test("게임 실행기 자체 점검은 한글 경로에서도 깨지지 않는다", () => {
  const output = execFileSync("cmd.exe", ["/d", "/c", "게임실행.cmd", "--check"], {
    cwd: resolve("."),
    encoding: "utf8",
  });

  assert.match(output, /LAUNCHER_CHECK_OK/);
});
