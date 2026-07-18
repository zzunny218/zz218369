import assert from "node:assert/strict";
import test from "node:test";
import { applyVideoSettings, normalizeVideoSettings } from "./video-settings.js";

test("비디오 설정은 미니맵과 우측 하단 캠 패널 표시 여부를 독립적으로 저장한다", () => {
  const root = { dataset: {} };
  const settings = applyVideoSettings(root, { miniMap: false, cameraPanel: true });
  assert.deepEqual(settings, { miniMap: false, cameraPanel: true });
  assert.equal(root.dataset.showMiniMap, "false");
  assert.equal(root.dataset.showCameraPanel, "true");
  assert.deepEqual(normalizeVideoSettings({ miniMap: "no" }), { miniMap: true, cameraPanel: true });
});
