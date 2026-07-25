import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyHandGesture,
  getHandLandmarksBySide,
  getPalmCenter,
  resolveThumbMiddlePinch,
} from "./hand-gesture-classifier.js";

test("손바닥 중심은 손목과 네 시작 관절의 평균 좌표다", () => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  [0, 5, 9, 13, 17].forEach((index, offset) => {
    landmarks[index] = { x: offset, y: offset * 2, z: offset * 3 };
  });

  assert.deepEqual(getPalmCenter(landmarks), { x: 2, y: 4, z: 6 });
});

test("검지만 펴진 손은 UI 포인팅 상태로 분류한다", () => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  landmarks[9] = { x: 0, y: 0.2, z: 0 };
  landmarks[6] = { x: 0, y: 0.2, z: 0 };
  landmarks[8] = { x: 0, y: 0.45, z: 0 };
  for (const [pip, tip] of [[10, 12], [14, 16], [18, 20]]) {
    landmarks[pip] = { x: 0, y: 0.25, z: 0 };
    landmarks[tip] = { x: 0, y: 0.12, z: 0 };
  }
  const gesture = classifyHandGesture(landmarks);
  assert.equal(gesture.isIndexExtended, true);
  assert.equal(gesture.isPalmOpen, false);
  assert.equal(gesture.isFist, false);
});

test("엄지·중지 핀치는 넉넉하게 시작되고 손 추적이 조금 흔들려도 유지된다", () => {
  assert.equal(resolveThumbMiddlePinch(0.84, false), true);
  assert.equal(resolveThumbMiddlePinch(0.96, true), true);
  assert.equal(resolveThumbMiddlePinch(1.09, true), false);
});

test("네 손가락 중 하나가 잠깐 가려져도 편 손으로 인식한다", () => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  for (const [pip, tip] of [[6, 8], [10, 12], [14, 16]]) {
    landmarks[pip] = { x: 0, y: 0.2, z: 0 };
    landmarks[tip] = { x: 0, y: 0.45, z: 0 };
  }
  landmarks[18] = { x: 0, y: 0.25, z: 0 };
  landmarks[20] = { x: 0, y: 0.12, z: 0 };

  assert.equal(classifyHandGesture(landmarks).isPalmOpen, true);
});

test("두 손이 같은 handedness로 순간 오분류되어도 양손 랜드마크를 보존한다", () => {
  const first = [{ x: 0.2, y: 0.5 }];
  const second = [{ x: 0.8, y: 0.5 }];
  const hands = getHandLandmarksBySide({
    handedness: [
      [{ categoryName: "Left" }],
      [{ categoryName: "Left" }],
    ],
    landmarks: [first, second],
  });

  assert.equal(hands.left, first);
  assert.equal(hands.right, second);
});
