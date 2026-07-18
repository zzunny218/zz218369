export const GestureMode = Object.freeze({
  EXPLORING: "exploring",
  RUNE_READY: "rune-ready",
  DRAWING: "drawing",
});

const HOLD_DURATION_MS = 200;

/** 손짓 입력 상태의 초기값을 만든다. */
export function createGestureState() {
  return {
    mode: GestureMode.EXPLORING,
    castType: null,
    isMoving: false,
    moveVector: { x: 0, y: 0 },
    cameraTurn: 0,
    selectedUiItemId: null,
  };
}

/**
 * 한 프레임의 손짓 입력으로 다음 입력 상태를 계산한다.
 * 룬 모드에서는 이동과 UI 선택을 항상 잠근다.
 */
export function transitionGestureState(state, input) {
  const nextState = {
    ...state,
    isMoving: false,
    moveVector: { x: 0, y: 0 },
    cameraTurn: 0,
    selectedUiItemId: null,
  };
  const rightFistHeld = input.rightFistHeldMs >= HOLD_DURATION_MS;

  if (state.mode === GestureMode.DRAWING) {
    if (rightFistHeld) {
      return { ...nextState, mode: GestureMode.EXPLORING, castType: null };
    }

    if (!input.rightThumbMiddlePinched) {
      return { ...nextState, mode: GestureMode.RUNE_READY };
    }

    return nextState;
  }

  if (state.mode === GestureMode.RUNE_READY) {
    if (rightFistHeld) {
      return { ...nextState, mode: GestureMode.EXPLORING, castType: null };
    }

    if (input.rightThumbMiddlePinched) {
      return { ...nextState, mode: GestureMode.DRAWING };
    }

    return nextState;
  }

  if (input.rightPalmOpenHeldMs >= HOLD_DURATION_MS) {
    return {
      ...nextState,
      mode: GestureMode.RUNE_READY,
      castType: input.leftHandClosed ? "attack" : "defense",
    };
  }

  if (input.uiHoverHeldMs >= HOLD_DURATION_MS && input.uiItemId) {
    return { ...nextState, selectedUiItemId: input.uiItemId };
  }

  if (input.leftPalmInMoveZoneHeldMs >= HOLD_DURATION_MS) {
    return { ...nextState, isMoving: true, moveVector: input.moveVector ?? { x: 0, y: 0 } };
  }

  return { ...nextState, cameraTurn: input.cameraTurn ?? 0 };
}
