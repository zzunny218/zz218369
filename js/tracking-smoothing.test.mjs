import assert from "node:assert/strict";
import test from "node:test";
import { AdaptivePointSmoother, interpolateTraceSegment } from "./tracking-smoothing.js";

test("추적 보정 좌표는 화면의 0~1 범위를 벗어나지 않는다", () => {
  const smoother = new AdaptivePointSmoother({ predictionMs: 40 });
  smoother.update({ x: 0.9, y: 0.5 }, 0);
  const point = smoother.update({ x: 1.2, y: 0.5 }, 16);
  assert.ok(point.x <= 1);
  assert.ok(point.x >= 0);
});

test("멀리 떨어진 룬 점 사이에 부드러운 중간점을 만든다", () => {
  const points = interpolateTraceSegment(
    { x: 0, y: 0 },
    { x: 0.1, y: 0 },
    { maximumSpacing: 0.02 },
  );
  assert.equal(points.length, 5);
  assert.deepEqual(points.at(-1), { x: 0.1, y: 0 });
});
