import { GestureMode } from "./gesture-engine.js";

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/** MediaPipe 손짓이 게임 루프에 전달할 입력 상태를 관리한다. */
export class HandInputController {
  constructor() {
    this.sceneInput = {
      isMoving: false,
      moveVector: { x: 0, y: 0 },
      cameraTurn: 0,
    };
    this.state = {
      mode: GestureMode.EXPLORING,
      castType: null,
      selectedUiItemId: null,
      handRolesReversed: false,
    };
  }

  enterRuneMode(castType) {
    if (castType !== "attack" && castType !== "defense") return false;
    this.setSceneMovement({ x: 0, y: 0 });
    this.state = {
      ...this.state,
      mode: GestureMode.RUNE_READY,
      castType,
      selectedUiItemId: null,
    };
    return true;
  }

  setCastType(castType) {
    if (this.state.mode === GestureMode.EXPLORING) return false;
    if (castType !== "attack" && castType !== "defense") return false;
    this.state = { ...this.state, castType };
    return true;
  }

  startDrawing() {
    if (this.state.mode !== GestureMode.RUNE_READY) return false;
    this.state = { ...this.state, mode: GestureMode.DRAWING };
    return true;
  }

  stopDrawing() {
    if (this.state.mode !== GestureMode.DRAWING) return false;
    this.state = { ...this.state, mode: GestureMode.RUNE_READY };
    return true;
  }

  exitRuneMode() {
    this.state = {
      ...this.state,
      mode: GestureMode.EXPLORING,
      castType: null,
    };
  }

  selectUi(uiItemId) {
    this.state = { ...this.state, selectedUiItemId: uiItemId };
  }

  setSceneInput({ moveVector = { x: 0, y: 0 }, cameraTurn = 0 } = {}) {
    const vector = moveVector;
    const length = Math.hypot(vector.x ?? 0, vector.y ?? 0);
    const scale = length > 1 ? 1 / length : 1;
    const normalizedMoveVector = {
      x: clamp((vector.x ?? 0) * scale, -1, 1),
      y: clamp((vector.y ?? 0) * scale, -1, 1),
    };
    this.sceneInput = {
      isMoving: Math.hypot(normalizedMoveVector.x, normalizedMoveVector.y) > 0.001,
      moveVector: normalizedMoveVector,
      cameraTurn: clamp(Number(cameraTurn) || 0, -1, 1),
    };
  }

  setSceneMovement(vector = { x: 0, y: 0 }) {
    this.setSceneInput({ moveVector: vector, cameraTurn: 0 });
  }

  getSceneInput() {
    if (this.state.mode !== GestureMode.EXPLORING) {
      return {
        isMoving: false,
        moveVector: { x: 0, y: 0 },
        cameraTurn: 0,
      };
    }
    return this.sceneInput;
  }

  setHandRolesReversed(reversed) {
    this.state = { ...this.state, handRolesReversed: Boolean(reversed) };
    return this.state.handRolesReversed;
  }

  toggleHandRoles() {
    return this.setHandRolesReversed(!this.state.handRolesReversed);
  }
}
