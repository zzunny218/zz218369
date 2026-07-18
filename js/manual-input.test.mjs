import assert from "node:assert/strict";
import test from "node:test";
import { GestureMode } from "./gesture-engine.js";
import { ManualInputController, calculateKeyboardMovement } from "./manual-input.js";

test("WASD는 대각선에서도 같은 크기의 이동 벡터를 만든다", () => {
  const vector = calculateKeyboardMovement(["w", "d"]);

  assert.ok(Math.abs(Math.hypot(vector.x, vector.y) - 1) < Number.EPSILON);
  assert.ok(vector.x > 0);
  assert.ok(vector.y < 0);
});

test("1과 2는 각각 공격·방어 룬 준비 모드로 진입한다", () => {
  const controller = new ManualInputController();
  controller.pressKey("1");
  assert.equal(controller.state.mode, GestureMode.RUNE_READY);
  assert.equal(controller.state.castType, "attack");

  controller.pressKey("2");
  assert.equal(controller.state.castType, "defense");
});

test("룬 모드에서는 이동과 UI 선택을 잠근다", () => {
  const controller = new ManualInputController();
  controller.pressKey("w");
  controller.pressKey("1");

  assert.equal(controller.getSceneInput().isMoving, false);
  assert.equal(controller.selectUi("menu"), false);
});

test("좌클릭 상태와 Esc가 룬 상태를 올바르게 전환한다", () => {
  const controller = new ManualInputController();
  controller.pressKey("1");
  assert.equal(controller.startDrawing(), true);
  assert.equal(controller.state.mode, GestureMode.DRAWING);
  assert.equal(controller.stopDrawing(), true);
  assert.equal(controller.state.mode, GestureMode.RUNE_READY);

  controller.pressKey("Escape");
  assert.equal(controller.state.mode, GestureMode.EXPLORING);
  assert.equal(controller.state.castType, null);
});

test("왼손·오른손 반전은 룬·카메라 버튼과 UI 버튼을 맞바꾼다", () => {
  const controller = new ManualInputController();
  assert.equal(controller.getRuneAndCameraButton(), 0);
  assert.equal(controller.getUiButton(), 2);
  assert.equal(controller.toggleMouseRoles(), true);
  assert.equal(controller.getRuneAndCameraButton(), 2);
  assert.equal(controller.getUiButton(), 0);
});
