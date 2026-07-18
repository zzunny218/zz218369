import assert from "node:assert/strict";
import test from "node:test";
import { findClosestOnCameraEnemy } from "./combat-targeting.js";

test("C형 타깃은 카메라에 잡힌 적 중 가장 가까운 적을 고른다", () => {
  const target = findClosestOnCameraEnemy(
    { x: 0, y: 0 },
    [
      { id: "offscreen", isOnCamera: false, isDefeated: false, position: { x: 0.1, y: 0.1 } },
      { id: "far", isOnCamera: true, isDefeated: false, position: { x: 4, y: 2 } },
      { id: "near", isOnCamera: true, isDefeated: false, position: { x: 1, y: 1 } },
    ],
  );

  assert.equal(target?.id, "near");
});
