import assert from "node:assert/strict";
import test from "node:test";
import { GestureController } from "./gesture-controller.js";
import { GestureMode } from "./gesture-engine.js";

const idle = {
  leftHandClosed: false,
  leftPalmInMoveZone: false,
  rightFist: false,
  rightPalmOpen: false,
  rightThumbMiddlePinched: false,
  uiHover: false,
  uiItemId: null,
};

test("제스처 컨트롤러는 0.2초 동안 편 오른손이 유지된 뒤 룬 모드에 진입한다", () => {
  const controller = new GestureController();
  controller.updateFromObservations({ ...idle, leftHandClosed: true, rightPalmOpen: true }, 1000);
  const state = controller.updateFromObservations(
    { ...idle, leftHandClosed: true, rightPalmOpen: true },
    1200,
  );

  assert.equal(state.mode, GestureMode.RUNE_READY);
  assert.equal(state.castType, "attack");
});

test("제스처 컨트롤러는 오른손 주먹 유지로 룬 모드를 종료한다", () => {
  const controller = new GestureController();
  controller.state = { ...controller.state, mode: GestureMode.RUNE_READY, castType: "defense" };
  controller.updateFromObservations({ ...idle, rightFist: true }, 1000);
  const state = controller.updateFromObservations({ ...idle, rightFist: true }, 1200);

  assert.equal(state.mode, GestureMode.EXPLORING);
});
