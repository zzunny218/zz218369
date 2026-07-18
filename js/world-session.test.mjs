import assert from "node:assert/strict";
import test from "node:test";
import { createSeededRandom, generateBossDungeon, generateDungeon } from "./dungeon-generator.js";
import { createPlayerProgress } from "./player-resources.js";
import {
  DOOR_WORLD_HEIGHT,
  DOOR_WORLD_WIDTH,
  PLAYER_WORLD_HEIGHT,
  PLAYER_SPEED_TEMPORARY,
  createWorldSession,
  findEnteredStagePortal,
  respawnPlayer,
  rotateWorldCamera,
  saveCampfireSpawnPoint,
  updateWorldSession,
} from "./world-session.js";

test("문은 한 격자보다 좁고 플레이어보다 약간 높다", () => {
  assert.ok(DOOR_WORLD_WIDTH < 1);
  assert.equal(DOOR_WORLD_HEIGHT, PLAYER_WORLD_HEIGHT * 1.05);
});

test("플레이어 이동속도 임시값은 기존 2.6보다 빠른 3.6이다", () => {
  assert.equal(PLAYER_SPEED_TEMPORARY, 3.6);
});

test("플레이어는 시작방의 유일한 문과 NPC 방향을 바라본다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(7) });
  const session = createWorldSession(dungeon);
  assert.equal(session.player.facing, dungeon.startDoorDirection);
  assert.equal(Math.hypot(session.player.x, session.player.z), 2);
  assert.ok(session.player.x * session.npc.x + session.player.z * session.npc.z < 0);
  assert.equal(Math.sign(session.npc.x), Math.sign(dungeon.roomById["room-1"].x));
  assert.equal(Math.sign(session.npc.z), Math.sign(dungeon.roomById["room-1"].y));
});

test("NPC에게 가까이 이동하면 대사 범위에 들어간다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(3) });
  const session = createWorldSession(dungeon);
  for (let index = 0; index < 12; index += 1) {
    updateWorldSession(session, dungeon, { isMoving: true, moveVector: { x: 0, y: -1 } }, 100);
  }
  assert.equal(session.npcNearby, true);
});

test("NPC 스승 그리모어는 닉네임과 손 반전 설정을 반영한 대사 13개를 가진다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(3) });
  const session = createWorldSession(dungeon, {
    playerProgress: createPlayerProgress({ nickname: "루나" }),
    mouseRolesReversed: true,
  });
  assert.equal(Math.hypot(session.npc.x, session.npc.z), 4);
  assert.equal(session.npc.name, "스승 그리모어");
  assert.equal(session.npc.dialogues.length, 13);
  assert.match(session.npc.dialogues[0], /루나여/);
  assert.match(session.npc.dialogues[7], /오른손/);
});

test("시작방의 유일한 문을 통과하면 연결된 첫 전투방으로 이동한다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(11) });
  const session = createWorldSession(dungeon);
  for (let index = 0; index < 34; index += 1) {
    updateWorldSession(session, dungeon, { isMoving: true, moveVector: { x: 0, y: -1 } }, 100);
  }
  assert.equal(session.currentRoomId, "room-1");
  assert.equal(session.visitedRoomIds.has("room-1"), true);
});

test("몬스터가 살아 있는 전투방에서는 문을 통과할 수 없다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(11) });
  const session = createWorldSession(dungeon);
  for (let index = 0; index < 34; index += 1) {
    updateWorldSession(session, dungeon, { isMoving: true, moveVector: { x: 0, y: -1 } }, 100);
  }
  const combatRoomId = session.currentRoomId;
  for (let index = 0; index < 34; index += 1) {
    updateWorldSession(
      session,
      dungeon,
      { isMoving: true, moveVector: { x: 0, y: 1 } },
      100,
      { canLeaveCurrentRoom: () => false },
    );
  }
  assert.equal(session.currentRoomId, combatRoomId);
  assert.equal(session.lastWorldEvent?.type, "door-locked");
});

test("체력이 다 닳으면 현재 전투 노드의 시작 스폰포인트로 돌아간다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(21) });
  const session = createWorldSession(dungeon);
  session.currentRoomId = "room-1";
  session.player.x = 3;
  session.player.z = -2;
  session.player.health = 0;
  respawnPlayer(session);
  assert.equal(session.currentRoomId, dungeon.startRoomId);
  assert.deepEqual({ x: session.player.x, z: session.player.z }, {
    x: session.spawnPoint.x,
    z: session.spawnPoint.z,
  });
  assert.equal(session.player.health, session.player.maximumHealth);
});

test("보스 앞 상점 모닥불은 플레이어의 새 스폰포인트가 된다", () => {
  const dungeon = generateBossDungeon({ random: createSeededRandom(22) });
  const session = createWorldSession(dungeon);
  const shopRoom = dungeon.roomById[dungeon.shopRoomId];
  const saved = saveCampfireSpawnPoint(session, shopRoom);
  assert.equal(saved.roomId, shopRoom.id);
  assert.equal(Math.hypot(saved.x - shopRoom.campfire.x, saved.z - shopRoom.campfire.z), 2);
  session.currentRoomId = dungeon.bossRoomId;
  session.player.health = 0;
  respawnPlayer(session);
  assert.equal(session.currentRoomId, shopRoom.id);
});

test("완료방 몬스터를 모두 처치한 뒤에만 상점과 다음 스테이지 통로를 감지한다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(31) });
  const session = createWorldSession(dungeon);
  const room = dungeon.roomById[dungeon.stageEndRoomId];
  session.currentRoomId = room.id;
  session.player.x = room.stagePortals[0].x;
  session.player.z = room.stagePortals[0].z;
  assert.equal(findEnteredStagePortal(session, room, false), null);
  assert.equal(findEnteredStagePortal(session, room, true)?.type, "shop");
});

test("카메라를 회전하면 WASD 이동 방향과 시야각이 함께 바뀐다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(5) });
  const session = createWorldSession(dungeon);
  dungeon.roomById[session.currentRoomId].rocks = [];
  session.player.x = 0;
  session.player.z = 0;
  session.player.cameraYaw = 0;
  rotateWorldCamera(session, Math.PI / 2);
  updateWorldSession(session, dungeon, { isMoving: true, moveVector: { x: 0, y: -1 }, cameraTurn: 0 }, 100);
  assert.ok(session.player.x > 0);
  assert.ok(Math.abs(session.player.z) < 0.001);
});

test("플레이어는 바위가 차지한 격자 칸을 통과하지 못한다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(8) });
  const session = createWorldSession(dungeon);
  session.player.x = 0;
  session.player.z = 0;
  session.player.cameraYaw = 0;
  dungeon.roomById[session.currentRoomId].rocks = [{ x: 0, z: -0.5, radius: 0.42 }];
  updateWorldSession(session, dungeon, { isMoving: true, moveVector: { x: 0, y: -1 }, cameraTurn: 0 }, 100);
  assert.equal(session.player.z, 0);
});

test("대각선으로 맞닿은 두 돌의 모서리 사이를 통과하지 못한다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(8) });
  const session = createWorldSession(dungeon);
  session.player.x = 0;
  session.player.z = 0;
  session.player.cameraYaw = 0;
  dungeon.roomById[session.currentRoomId].rocks = [
    { x: 0, z: -1, radius: 0.5 },
    { x: -1, z: 0, radius: 0.5 },
  ];
  for (let index = 0; index < 10; index += 1) {
    updateWorldSession(session, dungeon, { isMoving: true, moveVector: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, cameraTurn: 0 }, 100);
  }
  assert.ok(session.player.x > -0.3);
  assert.ok(session.player.z > -0.3);
});
