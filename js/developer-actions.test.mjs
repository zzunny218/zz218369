import assert from "node:assert/strict";
import test from "node:test";
import { createSeededRandom, generateDungeon } from "./dungeon-generator.js";
import {
  DEVELOPER_ATTACK_POWER,
  clearStageEndRoom,
  setDeveloperAttackPower,
} from "./developer-actions.js";
import { createPlayerProgress } from "./player-resources.js";
import { createWorldSession } from "./world-session.js";

test("단계 클리어 개발자 명령은 황금방으로 이동하고 그 방의 적을 모두 처치한다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(72) });
  const session = createWorldSession(dungeon);
  const roomId = dungeon.stageEndRoomId;
  const monstersByRoom = {
    [roomId]: [
      { currentHealth: 20, stats: { health: 20 }, aiState: "walking", pendingAttackType: "melee" },
      { currentHealth: 40, stats: { health: 40 }, aiState: "attacking", pendingAttackType: "ranged" },
    ],
  };
  const result = clearStageEndRoom({ dungeon, session, monstersByRoom });
  assert.equal(session.currentRoomId, roomId);
  assert.equal(result?.room.id, roomId);
  assert.equal(result?.defeatedCount, 2);
  assert.ok(monstersByRoom[roomId].every((monster) => monster.currentHealth === 0));
  assert.deepEqual({ x: session.player.x, z: session.player.z }, { x: 0, z: 0 });
});

test("공격력 무한 개발자 명령은 진행도와 현재 플레이어 공격력을 10000으로 만든다", () => {
  const progress = createPlayerProgress();
  const player = { attackPower: 100 };
  assert.equal(setDeveloperAttackPower(progress, player), DEVELOPER_ATTACK_POWER);
  assert.equal(progress.attackPower, 10000);
  assert.equal(player.attackPower, 10000);
});
