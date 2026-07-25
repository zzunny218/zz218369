import assert from "node:assert/strict";
import test from "node:test";
import { HandLandmarkStabilizer } from "./hand-landmark-stabilizer.js";

test("한 손이 몇 프레임 누락되어도 양손 랜드마크를 잠시 유지한다", () => {
  const stabilizer = new HandLandmarkStabilizer({ graceMs: 420 });
  const left = [{ x: 0.2, y: 0.5 }];
  const right = [{ x: 0.8, y: 0.5 }];

  assert.deepEqual(stabilizer.update({ left, right }, 1000), { left, right });
  assert.deepEqual(stabilizer.update({ left: null, right }, 1250), { left, right });
  assert.deepEqual(stabilizer.update({ left: null, right }, 1450), { left: null, right });
});

test("초기화하면 보관한 손 랜드마크를 즉시 제거한다", () => {
  const stabilizer = new HandLandmarkStabilizer();
  stabilizer.update({ left: [{ x: 0.2 }], right: [{ x: 0.8 }] }, 100);
  stabilizer.reset();

  assert.deepEqual(stabilizer.update({}, 101), { left: null, right: null });
});
