import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTargetYaw,
  findClosestLivingEnemy,
  findClosestOnCameraEnemy,
  getRuneTargetAimPoint,
  interpolateTargetYaw,
} from "./combat-targeting.js";

test("C형 타깃은 카메라에 잡힌 적 중 가장 가까운 적을 고른다", () => {
  const target = findClosestOnCameraEnemy(
    { x: 0, y: 0 },
    [
      { id: "offscreen", isOnCamera: false, isDefeated: false, position: { x: 0.1, y: 0.1 } },
      { id: "far", isOnCamera: true, isDefeated: false, position: { x: 4, y: 2 } },
      { id: "near", isOnCamera: true, isDefeated: false, position: { x: 1, y: 1 } },
    ],
  );

  assert.equal(target?.id, "near");
});

test("룬 자동 조준은 현재 방에서 가장 가까운 생존 적을 선택한다", () => {
  const target = findClosestLivingEnemy(
    { x: 0, z: 0 },
    [
      { id: "defeated", currentHealth: 0, position: { x: 0.1, z: 0.1 } },
      { id: "far", currentHealth: 20, position: { x: 5, z: -4 } },
      { id: "near", currentHealth: 10, position: { x: -1, z: -2 } },
    ],
  );
  assert.equal(target?.id, "near");
});

test("룬 자동 조준 각도는 목표 방향으로 최단 회전하며 부드럽게 수렴한다", () => {
  const targetYaw = calculateTargetYaw({ x: 0, z: 0 }, { x: 3, z: 0 });
  assert.equal(targetYaw, Math.PI / 2);
  const first = interpolateTargetYaw(0, targetYaw, 16);
  const second = interpolateTargetYaw(first, targetYaw, 160);
  assert.ok(first > 0 && first < targetYaw);
  assert.ok(second > first && second < targetYaw);
  assert.equal(interpolateTargetYaw(targetYaw - 0.0001, targetYaw, 16), targetYaw);
});

test("보스 룬 자동 조준은 일반 적보다 낮은 몸체 중앙을 겨냥한다", () => {
  const normalPoint = getRuneTargetAimPoint({
    position: { x: 1, y: 0, z: -2 },
    stats: { size: 3.15 },
  });
  const bossPoint = getRuneTargetAimPoint({
    isBoss: true,
    position: { x: 1, y: 0, z: -2 },
    stats: { size: 3.15 },
  });

  assert.equal(normalPoint.y, 3.15 * 0.8);
  assert.equal(bossPoint.y, 3.15 * 0.45);
  assert.ok(bossPoint.y < normalPoint.y);
});
