import assert from "node:assert/strict";
import test from "node:test";
import {
  ROOM_GRID_SIZE,
  createSeededRandom,
  generateDungeon,
  generateBossDungeon,
  isRoomRockLayoutWalkable,
} from "./dungeon-generator.js";

test("던전은 8~10개의 연결된 방을 만들고 시작방 출구는 하나다", () => {
  assert.equal(ROOM_GRID_SIZE, 15);
  for (let seed = 1; seed <= 20; seed += 1) {
    const dungeon = generateDungeon({ random: createSeededRandom(seed) });
    assert.ok(dungeon.rooms.length >= 8 && dungeon.rooms.length <= 10);
    assert.equal(Object.keys(dungeon.roomById[dungeon.startRoomId].doors).length, 1);
    assert.deepEqual(
      { x: dungeon.roomById[dungeon.startRoomId].campfire.x, z: dungeon.roomById[dungeon.startRoomId].campfire.z },
      { x: 0, z: 0 },
    );
    const startDirection = dungeon.startDoorDirection;
    const spawnPosition = {
      x: startDirection === "east" ? -2 : startDirection === "west" ? 2 : 0,
      z: startDirection === "north" ? 2 : startDirection === "south" ? -2 : 0,
    };
    assert.ok(dungeon.roomById[dungeon.startRoomId].rocks.every((rock) => (
      Math.hypot(rock.x - spawnPosition.x, rock.z - spawnPosition.z) >= 1.6
    )));
    assert.equal(dungeon.roomById[dungeon.stageEndRoomId].isStageEnd, true);
    assert.equal(dungeon.roomById[dungeon.stageEndRoomId].type, "combat");
    assert.deepEqual(dungeon.roomById[dungeon.stageEndRoomId].stagePortals.map((portal) => portal.type), ["shop", "next-stage"]);
    assert.equal(dungeon.rooms.filter((room) => room.isStageEnd).length, 1);
    for (const room of dungeon.rooms) {
      assert.ok(Object.keys(room.doors).length >= 1);
      assert.ok(room.rocks.length >= 6 && room.rocks.length <= 10);
      assert.equal(isRoomRockLayoutWalkable(room, room.rocks), true);
      const groups = Map.groupBy(room.rocks, (rock) => rock.groupId);
      for (const group of groups.values()) {
        assert.ok(group.length >= 2 && group.length <= 3);
        for (const rock of group) {
          assert.ok(group.some((neighbor) => neighbor !== rock
            && Math.abs(neighbor.x - rock.x) <= 1
            && Math.abs(neighbor.z - rock.z) <= 1));
        }
      }
      for (const rock of room.rocks) {
        assert.equal(Math.abs(rock.x % 1), 0);
        assert.equal(Math.abs(rock.z % 1), 0);
        assert.equal(rock.radius, 0.5);
      }
    }
  }
});

test("보스 던전은 상점방과 단독 연결된 빨간 보스방을 하나 만든다", () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const dungeon = generateBossDungeon({ random: createSeededRandom(seed) });
    const bossRoom = dungeon.roomById[dungeon.bossRoomId];
    const shopRoom = dungeon.roomById[dungeon.shopRoomId];
    assert.equal(bossRoom.type, "boss");
    assert.equal(bossRoom.isBossRoom, true);
    assert.equal(Object.keys(bossRoom.doors).length, 1);
    assert.equal(Object.values(bossRoom.doors)[0], shopRoom.id);
    assert.equal(shopRoom.type, "shop");
    assert.deepEqual(shopRoom.rocks, []);
    assert.deepEqual({ x: shopRoom.campfire.x, z: shopRoom.campfire.z }, { x: 0, z: 0 });
    assert.ok(Object.hasOwn(shopRoom.doors, shopRoom.campfire.spawnFacing));
    assert.equal(shopRoom.doors[shopRoom.campfire.spawnFacing], bossRoom.id);
    assert.equal(dungeon.rooms.filter((room) => room.isStageEnd).length, 0);
  }
});
