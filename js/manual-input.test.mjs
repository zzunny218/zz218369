import assert from "node:assert/strict";
import test from "node:test";
import { calculatePointerCameraTurn, createManualInputState } from "./manual-input.js";

test("WASD와 방향키는 룬 모드 밖에서 사용할 정규화된 이동 벡터를 만든다", () => {
  const input = createManualInputState();
  input.setKey("KeyW", true);
  input.setKey("KeyD", true);
  const sceneInput = input.getSceneInput();
  assert.ok(Math.abs(sceneInput.moveVector.x - Math.SQRT1_2) < 0.000001);
  assert.ok(Math.abs(sceneInput.moveVector.y + Math.SQRT1_2) < 0.000001);
});

test("Q와 E는 카메라 회전 입력이며 초기화하면 모든 입력이 사라진다", () => {
  const input = createManualInputState();
  input.setKey("KeyQ", true);
  assert.equal(input.getSceneInput().cameraTurn, -1);
  input.reset();
  assert.deepEqual(input.getSceneInput(), { moveVector: { x: 0, y: 0 }, cameraTurn: 0 });
});

test("좌클릭 드래그 카메라 회전량은 포인터 이동에 비례하고 큰 튐은 제한한다", () => {
  assert.ok(Math.abs(calculatePointerCameraTurn(20) - 0.11) < 0.000001);
  assert.ok(Math.abs(calculatePointerCameraTurn(-20) + 0.11) < 0.000001);
  assert.ok(Math.abs(calculatePointerCameraTurn(1000) - 0.44) < 0.000001);
  assert.equal(calculatePointerCameraTurn(Number.NaN), 0);
});
