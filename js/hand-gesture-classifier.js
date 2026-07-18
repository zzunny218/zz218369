const LANDMARK = Object.freeze({
  WRIST: 0,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
  THUMB_TIP: 4,
});

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y, (first.z ?? 0) - (second.z ?? 0));
}

/** 손가락 끝이 중간 관절보다 손목에서 충분히 멀면 편 손가락으로 본다. */
function isFingerExtended(landmarks, tipIndex, pipIndex) {
  const wrist = landmarks[LANDMARK.WRIST];
  const tipDistance = distance(landmarks[tipIndex], wrist);
  const pipDistance = distance(landmarks[pipIndex], wrist);
  return tipDistance > pipDistance * 1.1;
}

/** 하나의 손 랜드마크에서 룬 모드에 필요한 제스처를 추출한다. */
export function classifyHandGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return { isPalmOpen: false, isFist: false, isThumbMiddlePinched: false };
  }

  const extendedFingerCount = [
    [LANDMARK.INDEX_TIP, LANDMARK.INDEX_PIP],
    [LANDMARK.MIDDLE_TIP, LANDMARK.MIDDLE_PIP],
    [LANDMARK.RING_TIP, LANDMARK.RING_PIP],
    [LANDMARK.PINKY_TIP, LANDMARK.PINKY_PIP],
  ].filter(([tip, pip]) => isFingerExtended(landmarks, tip, pip)).length;

  const palmSize = distance(landmarks[LANDMARK.WRIST], landmarks[LANDMARK.MIDDLE_MCP]);
  const thumbMiddleDistance = distance(landmarks[LANDMARK.THUMB_TIP], landmarks[LANDMARK.MIDDLE_TIP]);

  return {
    isPalmOpen: extendedFingerCount === 4,
    isFist: extendedFingerCount === 0,
    isThumbMiddlePinched: palmSize > 0 && thumbMiddleDistance / palmSize <= 0.55,
  };
}

/** MediaPipe 결과에서 왼손·오른손 제스처를 분리한다. */
export function classifyHands(result) {
  const hands = { left: null, right: null };

  (result.handedness ?? []).forEach((categories, index) => {
    const label = (categories[0]?.categoryName ?? "").toLowerCase();
    const side = label === "left" || label === "right" ? label : null;

    if (side) {
      hands[side] = classifyHandGesture(result.landmarks?.[index]);
    }
  });

  return hands;
}

/** MediaPipe 결과에서 손 구분별 랜드마크를 가져온다. */
export function getHandLandmarksBySide(result) {
  const hands = { left: null, right: null };

  (result.handedness ?? []).forEach((categories, index) => {
    const label = (categories[0]?.categoryName ?? "").toLowerCase();
    if (label === "left" || label === "right") {
      hands[label] = result.landmarks?.[index] ?? null;
    }
  });

  return hands;
}

/** 손목과 네 손가락 시작 관절의 평균으로 손바닥 중심점을 구한다. */
export function getPalmCenter(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return null;
  }

  const palmLandmarkIndexes = [0, 5, 9, 13, 17];
  const total = palmLandmarkIndexes.reduce(
    (sum, index) => ({
      x: sum.x + landmarks[index].x,
      y: sum.y + landmarks[index].y,
      z: sum.z + (landmarks[index].z ?? 0),
    }),
    { x: 0, y: 0, z: 0 },
  );

  return {
    x: total.x / palmLandmarkIndexes.length,
    y: total.y / palmLandmarkIndexes.length,
    z: total.z / palmLandmarkIndexes.length,
  };
}

/** 손바닥의 좌·우 기울기를 -1(왼쪽)부터 1(오른쪽) 범위로 반환한다. */
export function getPalmHorizontalTilt(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return 0;
  }

  const wrist = landmarks[LANDMARK.WRIST];
  const middleMcp = landmarks[LANDMARK.MIDDLE_MCP];
  const axisLength = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y);

  return axisLength === 0 ? 0 : (middleMcp.x - wrist.x) / axisLength;
}
