/** 카메라 화면 안에 있는 생존 적 중 플레이어와 가장 가까운 적을 반환한다. */
export function findClosestOnCameraEnemy(playerPosition, enemies) {
  const candidates = enemies.filter((enemy) => enemy.isOnCamera && !enemy.isDefeated);

  return candidates.reduce((closest, enemy) => {
    const distanceSquared = (enemy.position.x - playerPosition.x) ** 2 + (enemy.position.y - playerPosition.y) ** 2;
    if (!closest || distanceSquared < closest.distanceSquared) {
      return { enemy, distanceSquared };
    }
    return closest;
  }, null)?.enemy ?? null;
}

/** 현재 방의 생존 적 중 플레이어와 월드 좌표상 가장 가까운 적을 반환한다. */
export function findClosestLivingEnemy(playerPosition, enemies = []) {
  return enemies.reduce((closest, enemy) => {
    if ((enemy.currentHealth ?? enemy.stats?.health ?? 0) <= 0) return closest;
    const position = enemy.position ?? enemy;
    const distanceSquared = (position.x - playerPosition.x) ** 2
      + (position.z - playerPosition.z) ** 2;
    if (!closest || distanceSquared < closest.distanceSquared) {
      return { enemy, distanceSquared };
    }
    return closest;
  }, null)?.enemy ?? null;
}

/** 게임의 전방축(-Z)을 기준으로 목표를 정면에 두는 카메라 각도를 계산한다. */
export const REGULAR_RUNE_AIM_HEIGHT_RATIO = 0.8;
export const BOSS_RUNE_AIM_HEIGHT_RATIO = 0.45;

/** 룬 자동 조준이 겨냥할 적의 몸체 중심 좌표를 계산한다. */
export function getRuneTargetAimPoint(enemy) {
  const position = enemy?.position ?? enemy ?? { x: 0, y: 0, z: 0 };
  const size = Math.max(0, Number(enemy?.stats?.size) || 1);
  const heightRatio = enemy?.isBoss
    ? BOSS_RUNE_AIM_HEIGHT_RATIO
    : REGULAR_RUNE_AIM_HEIGHT_RATIO;
  return {
    x: position.x,
    y: (position.y ?? 0) + size * heightRatio,
    z: position.z,
  };
}

export function calculateTargetYaw(origin, target) {
  return Math.atan2(target.x - origin.x, -(target.z - origin.z));
}

/** 최단 회전 방향으로 카메라를 부드럽게 목표 각도에 접근시킨다. */
export function interpolateTargetYaw(currentYaw, targetYaw, elapsedMs, responseMs = 150) {
  const difference = Math.atan2(
    Math.sin(targetYaw - currentYaw),
    Math.cos(targetYaw - currentYaw),
  );
  if (Math.abs(difference) < 0.0005) return targetYaw;
  const progress = 1 - Math.exp(-Math.max(0, elapsedMs) / Math.max(1, responseMs));
  return Math.atan2(
    Math.sin(currentYaw + difference * progress),
    Math.cos(currentYaw + difference * progress),
  );
}
