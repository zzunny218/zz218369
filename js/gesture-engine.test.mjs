import assert from "node:assert/strict";
import test from "node:test";
import { GestureMode, createGestureState, transitionGestureState } from "./gesture-engine.js";

const idleInput = {
  leftHandClosed: false,
  leftPalmInMoveZoneHeldMs: 0,
  rightFistHeldMs: 0,
  rightPalmOpenHeldMs: 0,
  rightThumbMiddlePinched: false,
  uiHoverHeldMs: 0,
  uiItemId: null,
};

test("오른손 편 손 0.2초 유지로 룬 모드에 진입한다", () => {
  const next = transitionGestureState(createGestureState(), {
    ...idleInput,
    leftHandClosed: true,
    rightPalmOpenHeldMs: 200,
  });

  assert.equal(next.mode, GestureMode.RUNE_READY);
  assert.equal(next.castType, "attack");
});

test("엄지-중지 핀치가 유지될 때만 그리기 상태가 된다", () => {
  const readyState = { ...createGestureState(), mode: GestureMode.RUNE_READY, castType: "defense" };
  const drawingState = transitionGestureState(readyState, {
    ...idleInput,
    rightThumbMiddlePinched: true,
  });
  const releasedState = transitionGestureState(drawingState, idleInput);

  assert.equal(drawingState.mode, GestureMode.DRAWING);
  assert.equal(releasedState.mode, GestureMode.RUNE_READY);
});

test("오른손 주먹 0.2초 유지로 어느 룬 상태에서든 탐험으로 돌아간다", () => {
  const state = { ...createGestureState(), mode: GestureMode.DRAWING, castType: "attack" };
  const next = transitionGestureState(state, { ...idleInput, rightFistHeldMs: 200 });

  assert.equal(next.mode, GestureMode.EXPLORING);
  assert.equal(next.castType, null);
});

test("UI 선택은 이동보다 우선하며 룬 모드에서는 둘 다 잠긴다", () => {
  const selected = transitionGestureState(createGestureState(), {
    ...idleInput,
    leftPalmInMoveZoneHeldMs: 200,
    uiHoverHeldMs: 200,
    uiItemId: "menu",
  });
  const locked = transitionGestureState(
    { ...createGestureState(), mode: GestureMode.RUNE_READY },
    { ...idleInput, leftPalmInMoveZoneHeldMs: 200, uiHoverHeldMs: 200, uiItemId: "menu" },
  );

  assert.equal(selected.selectedUiItemId, "menu");
  assert.equal(selected.isMoving, false);
  assert.equal(locked.selectedUiItemId, null);
  assert.equal(locked.isMoving, false);
});
