import { GestureMode } from "./gesture-engine.js";

const MOVEMENT_KEYS = new Set(["w", "a", "s", "d"]);

/** 눌린 WASD 키를 대각선에서도 같은 속도의 이동 벡터로 바꾼다. */
export function calculateKeyboardMovement(pressedKeys) {
  const keys = new Set([...pressedKeys].map((key) => key.toLowerCase()));
  const x = Number(keys.has("d")) - Number(keys.has("a"));
  const y = Number(keys.has("s")) - Number(keys.has("w"));
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}

/** 카메라 없이 사용하는 키보드·마우스 입력 상태를 관리한다. */
export class ManualInputController {
  constructor() {
    this.pressedMovementKeys = new Set();
    this.state = {
      mode: GestureMode.EXPLORING,
      castType: null,
      selectedUiItemId: null,
      mouseRolesReversed: false,
    };
  }

  /** 키 입력을 반영하고 화면에서 처리할 동작 이름을 반환한다. */
  pressKey(key) {
    const normalizedKey = key.toLowerCase();

    if (MOVEMENT_KEYS.has(normalizedKey)) {
      this.pressedMovementKeys.add(normalizedKey);
      return "movement";
    }

    if (normalizedKey === "1") {
      this.#enterRuneMode("attack");
      return "attack-rune";
    }

    if (normalizedKey === "2") {
      this.#enterRuneMode("defense");
      return "defense-rune";
    }

    if (normalizedKey === "escape" && this.state.mode !== GestureMode.EXPLORING) {
      this.exitRuneMode();
      return "cancel-rune";
    }

    if (normalizedKey === "enter" && this.state.mode !== GestureMode.EXPLORING) {
      this.exitRuneMode();
      return "finish-rune";
    }

    return null;
  }

  releaseKey(key) {
    this.pressedMovementKeys.delete(key.toLowerCase());
  }

  /** 룬 모드에서 좌클릭을 누른 동안만 그리기 상태가 된다. */
  startDrawing() {
    if (this.state.mode !== GestureMode.RUNE_READY) {
      return false;
    }

    this.state = { ...this.state, mode: GestureMode.DRAWING };
    return true;
  }

  stopDrawing() {
    if (this.state.mode !== GestureMode.DRAWING) {
      return false;
    }

    this.state = { ...this.state, mode: GestureMode.RUNE_READY };
    return true;
  }

  /** 룬 모드가 아닐 때만 우클릭 UI 선택을 허용한다. */
  selectUi(uiItemId) {
    if (this.state.mode !== GestureMode.EXPLORING) {
      return false;
    }

    this.state = { ...this.state, selectedUiItemId: uiItemId };
    return true;
  }

  exitRuneMode() {
    this.state = {
      ...this.state,
      mode: GestureMode.EXPLORING,
      castType: null,
    };
  }

  /** 기본 좌클릭/우클릭 역할을 서로 바꾸고 현재 상태를 반환한다. */
  toggleMouseRoles() {
    this.state = {
      ...this.state,
      mouseRolesReversed: !this.state.mouseRolesReversed,
    };
    return this.state.mouseRolesReversed;
  }

  getRuneAndCameraButton() {
    return this.state.mouseRolesReversed ? 2 : 0;
  }

  getUiButton() {
    return this.state.mouseRolesReversed ? 0 : 2;
  }

  /** 장면 루프가 바로 사용할 수 있는 이동 입력을 만든다. */
  getSceneInput() {
    const moveVector = this.state.mode === GestureMode.EXPLORING
      ? calculateKeyboardMovement(this.pressedMovementKeys)
      : { x: 0, y: 0 };

    return {
      isMoving: moveVector.x !== 0 || moveVector.y !== 0,
      moveVector,
      cameraTurn: 0,
    };
  }

  #enterRuneMode(castType) {
    this.pressedMovementKeys.clear();
    this.state = {
      ...this.state,
      mode: GestureMode.RUNE_READY,
      castType,
      selectedUiItemId: null,
    };
  }
}
