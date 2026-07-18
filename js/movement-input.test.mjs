import assert from "node:assert/strict";
import test from "node:test";
import { calculateRadialMovement } from "./movement-input.js";

const center = { x: 100, y: 100 };

test("왼손 중심이 가운데 빈 공간에 있으면 정지한다", () => {
  const movement = calculateRadialMovement({ x: 120, y: 100 }, center, 100);

  assert.equal(movement.active, false);
  assert.deepEqual(movement.vector, { x: 0, y: 0 });
});

test("왼손 중심이 도넛 안에서 바깥으로 갈수록 빨라진다", () => {
  const inner = calculateRadialMovement({ x: 150, y: 100 }, center, 100);
  const outer = calculateRadialMovement({ x: 180, y: 100 }, center, 100);

  assert.equal(inner.active, true);
  assert.ok(outer.intensity > inner.intensity);
  assert.ok(outer.intensity < 1);
});

test("왼손 중심이 도넛 밖으로 나가면 해당 방향으로 최대속도가 된다", () => {
  const movement = calculateRadialMovement({ x: 100, y: 230 }, center, 100);

  assert.equal(movement.active, true);
  assert.equal(movement.intensity, 1);
  assert.deepEqual(movement.vector, { x: 0, y: 1 });
});
