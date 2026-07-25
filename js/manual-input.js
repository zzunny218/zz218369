const MOVEMENT_KEYS = Object.freeze({
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
});

const CAMERA_KEYS = Object.freeze({
  KeyQ: -1,
  KeyE: 1,
});

export const POINTER_CAMERA_SENSITIVITY = 0.0055;

export const MANUAL_GAMEPLAY_KEYS = Object.freeze([
  ...Object.keys(MOVEMENT_KEYS),
  ...Object.keys(CAMERA_KEYS),
]);

function clampVector(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 1) return vector;
  return { x: vector.x / length, y: vector.y / length };
}

/** 포인터가 한 프레임에 크게 튀어도 카메라가 순간이동하지 않도록 회전량을 제한한다. */
export function calculatePointerCameraTurn(
  deltaX,
  sensitivity = POINTER_CAMERA_SENSITIVITY,
) {
  if (!Number.isFinite(deltaX) || !Number.isFinite(sensitivity)) return 0;
  const boundedDelta = Math.max(-80, Math.min(80, deltaX));
  return boundedDelta * sensitivity;
}

/** 룬 모드 밖에서 사용할 키보드 대체 이동·카메라 입력을 관리한다. */
export function createManualInputState() {
  const pressed = new Set();

  return {
    setKey(code, active) {
      if (!MANUAL_GAMEPLAY_KEYS.includes(code)) return false;
      if (active) pressed.add(code);
      else pressed.delete(code);
      return true;
    },
    reset() {
      pressed.clear();
    },
    getSceneInput() {
      const movement = { x: 0, y: 0 };
      let cameraTurn = 0;
      for (const code of pressed) {
        const move = MOVEMENT_KEYS[code];
        if (move) {
          movement.x += move.x;
          movement.y += move.y;
        }
        cameraTurn += CAMERA_KEYS[code] ?? 0;
      }
      return {
        moveVector: clampVector(movement),
        cameraTurn: Math.max(-1, Math.min(1, cameraTurn)),
      };
    },
  };
}
