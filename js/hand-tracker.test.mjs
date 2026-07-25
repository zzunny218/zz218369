import assert from "node:assert/strict";
import test from "node:test";
import { getMediaPipeRuntimeSources } from "./hand-tracker.js";

test("배포 환경은 node_modules 대신 고정 버전 MediaPipe CDN을 우선 사용한다", () => {
  const [primary, fallback] = getMediaPipeRuntimeSources();

  assert.match(primary.moduleUrl, /^https:\/\/cdn\.jsdelivr\.net\//);
  assert.match(primary.moduleUrl, /@mediapipe\/tasks-vision@0\.10\.35/);
  assert.match(primary.wasmUrl, /\/wasm$/);
  assert.match(fallback.moduleUrl, /node_modules/);
});
