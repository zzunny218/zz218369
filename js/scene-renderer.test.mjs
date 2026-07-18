import assert from "node:assert/strict";
import test from "node:test";
import { createSceneState, updateSceneState } from "./scene-renderer.js";

test("이동 상태에서는 조이스틱 방향으로 플레이어 위치가 바뀐다", () => {
  const next = updateSceneState(
    createSceneState(),
    { isMoving: true, moveVector: { x: 1, y: -1 } },
    1000,
  );

  assert.deepEqual(next.playerOffset, { x: 0.45, y: -0.45 });
});

test("이동이 잠긴 상태에서는 플레이어 위치가 바뀌지 않는다", () => {
  const state = { playerOffset: { x: 0.2, y: -0.1 }, cameraYaw: 0 };
  const next = updateSceneState(state, { isMoving: false, moveVector: { x: 1, y: 1 } }, 1000);

  assert.equal(next, state);
});

test("카메라는 손바닥의 좌·우 기울기로만 수평 회전한다", () => {
  const next = updateSceneState(
    createSceneState(),
    { isMoving: false, moveVector: { x: 0, y: 0 }, cameraTurn: -0.5 },
    1000,
  );

  assert.equal(next.cameraYaw, -0.7);
  assert.deepEqual(next.playerOffset, { x: 0, y: 0 });
});
