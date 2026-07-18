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
