export const DEVELOPER_ATTACK_POWER = 10000;

/** 현재 전투 노드의 황금방으로 이동하고 그 방의 모든 적을 처치 상태로 만든다. */
export function clearStageEndRoom({ dungeon, session, monstersByRoom }) {
  if (!dungeon || !session) return null;
  const room = dungeon.roomById?.[dungeon.stageEndRoomId]
    ?? dungeon.rooms?.find((candidate) => candidate.isStageEnd)
    ?? null;
  if (!room) return null;

  session.currentRoomId = room.id;
  session.visitedRoomIds?.add(room.id);
  session.player.x = 0;
  session.player.z = 0;
  session.player.cameraYaw = 0;
  session.player.runeZoomProgress = 0;
  session.player.immobilizedMs = 0;
  session.lastWorldEvent = null;

  const monsters = monstersByRoom?.[room.id] ?? [];
  let defeatedCount = 0;
  for (const monster of monsters) {
    if ((monster.currentHealth ?? monster.stats?.health ?? 0) > 0) defeatedCount += 1;
    monster.currentHealth = 0;
    monster.aiState = "idle";
    monster.stateTimeMs = 0;
    monster.pendingAttackType = null;
    monster.attackPrepareMs = 0;
  }
  return { room, defeatedCount };
}

/** 개발자 명령으로 플레이어의 실제 공격력 수치를 10000으로 설정한다. */
export function setDeveloperAttackPower(progress, player = null) {
  if (progress) progress.attackPower = DEVELOPER_ATTACK_POWER;
  if (player) player.attackPower = DEVELOPER_ATTACK_POWER;
  return DEVELOPER_ATTACK_POWER;
}
