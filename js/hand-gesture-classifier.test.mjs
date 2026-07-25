import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyHandGesture,
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
