import assert from "node:assert/strict";
import test from "node:test";
import {
  appendRunePoint,
  beginRuneStroke,
  clearRuneTrace,
  countRunePoints,
  createRuneTrace,
  isScreenPointInsideRectangle,
  endRuneStroke,
  normalizeRunePoint,
} from "./rune-trace.js";

test("손 추적 x·y와 마우스 clientX·clientY를 모두 룬 영역 좌표로 판정한다", () => {
  const bounds = { left: 100, top: 80, right: 300, bottom: 280 };
  assert.equal(isScreenPointInsideRectangle({ x: 160, y: 120 }, bounds), true);
  assert.equal(isScreenPointInsideRectangle({ clientX: 260, clientY: 240 }, bounds), true);
  assert.equal(isScreenPointInsideRectangle({ x: 20, y: 120 }, bounds), false);
});

test("룬 좌표는 화면 크기와 무관한 0~1 범위로 저장된다", () => {
  const point = normalizeRunePoint(150, 100, { left: 50, top: 50, width: 200, height: 100 });
  assert.deepEqual(point, { x: 0.5, y: 0.5 });
});

test("여러 번의 드래그를 서로 다른 룬 획으로 기록한다", () => {
  const trace = createRuneTrace();
  beginRuneStroke(trace, { x: 0.1, y: 0.1 });
  appendRunePoint(trace, { x: 0.2, y: 0.2 });
  endRuneStroke(trace);
  beginRuneStroke(trace, { x: 0.7, y: 0.7 });
  endRuneStroke(trace);

  assert.equal(trace.strokes.length, 2);
  assert.equal(countRunePoints(trace), 3);

  clearRuneTrace(trace);
  assert.deepEqual(trace, createRuneTrace());
});
