import assert from "node:assert/strict";
import test from "node:test";
import { getPalmCenter } from "./hand-gesture-classifier.js";

test("손바닥 중심은 손목과 네 시작 관절의 평균 좌표다", () => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  [0, 5, 9, 13, 17].forEach((index, offset) => {
    landmarks[index] = { x: offset, y: offset * 2, z: offset * 3 };
  });

  assert.deepEqual(getPalmCenter(landmarks), { x: 2, y: 4, z: 6 });
});
