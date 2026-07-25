import assert from "node:assert/strict";
import test from "node:test";
import { GestureMode } from "./gesture-engine.js";
import { HandInputController } from "./hand-input.js";

test("손 입력은 공격·방어 룬 모드와 그리기 상태를 전환한다", () => {
  const controller = new HandInputController();
  assert.equal(controller.enterRuneMode("attack"), true);
  assert.equal(controller.state.castType, "attack");
  assert.equal(controller.startDrawing(), true);
  assert.equal(controller.state.mode, GestureMode.DRAWING);
  assert.equal(controller.stopDrawing(), true);
  controller.setCastType("defense");
  assert.equal(controller.state.castType, "defense");
  controller.exitRuneMode();
  assert.equal(controller.state.mode, GestureMode.EXPLORING);
});

test("룬 모드에서는 손 이동 벡터가 게임에 전달되지 않는다", () => {
  const controller = new HandInputController();
  controller.setSceneMovement({ x: 0.5, y: -0.5 });
  assert.equal(controller.getSceneInput().isMoving, true);
  controller.enterRuneMode("attack");
  assert.equal(controller.getSceneInput().isMoving, false);
});

test("대체조작의 이동과 카메라 회전 입력을 함께 보관한다", () => {
  const controller = new HandInputController();
  controller.setSceneInput({ moveVector: { x: 1, y: -1 }, cameraTurn: 0.7 });
  const sceneInput = controller.getSceneInput();
  assert.ok(Math.abs(sceneInput.moveVector.x - Math.SQRT1_2) < 0.000001);
  assert.equal(sceneInput.cameraTurn, 0.7);
});

test("손 역할 반전은 룬·UI 손과 이동 손 설정을 바꾼다", () => {
  const controller = new HandInputController();
  assert.equal(controller.state.handRolesReversed, false);
  assert.equal(controller.toggleHandRoles(), true);
  assert.equal(controller.state.handRolesReversed, true);
});
