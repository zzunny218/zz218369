import assert from "node:assert/strict";
import test from "node:test";
import { describeDetectedHands, toCanvasPoint } from "./hand-utils.js";

test("정규화된 랜드마크를 캔버스 좌표로 변환한다", () => {
  assert.deepEqual(toCanvasPoint({ x: 0.25, y: 0.5 }, 800, 600), { x: 200, y: 300 });
});

test("인식되지 않은 손은 안내 문구로 표시한다", () => {
  assert.deepEqual(describeDetectedHands({ handedness: [] }), ["인식된 손이 없습니다."]);
});

test("손 구분과 신뢰도를 표시한다", () => {
  const result = describeDetectedHands({
    handedness: [[{ categoryName: "Right", score: 0.937 }]],
  });

  assert.deepEqual(result, ["1번째 손: Right (94%)"]);
});
