export const RoomDirection = Object.freeze({
  NORTH: "north",
  EAST: "east",
  SOUTH: "south",
  WEST: "west",
});

export const DIRECTION_DATA = Object.freeze({
  [RoomDirection.NORTH]: { x: 0, y: -1, opposite: RoomDirection.SOUTH },
  [RoomDirection.EAST]: { x: 1, y: 0, opposite: RoomDirection.WEST },
  [RoomDirection.SOUTH]: { x: 0, y: 1, opposite: RoomDirection.NORTH },
  [RoomDirection.WEST]: { x: -1, y: 0, opposite: RoomDirection.EAST },
});

const DIRECTIONS = Object.keys(DIRECTION_DATA);
export const ROOM_GRID_SIZE = 15;
export const ROOM_CELL_SIZE = 1;
export const STAGE_END_PORTALS = Object.freeze([
  Object.freeze({ id: "shop", type: "shop", label: "상점", x: -2.25, z: -4.5, radius: 0.78 }),
  Object.freeze({ id: "next-stage", type: "next-stage", label: "다음 스테이지", x: 2.25, z: -4.5, radius: 0.78 }),
]);

/** 테스트와 재현 가능한 맵 생성에 사용하는 간단한 시드 난수다. */
export function createSeededRandom(seed = Date.now()) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function coordinateKey(x, y) {
  return `${x},${y}`;
}

function pickRandom(items, random) {
  return items[Math.floor(random() * items.length)];
}

function shuffled(items, random) {
  return [...items]
    .map((value) => ({ value, order: random() }))
    .sort((left, right) => left.order - right.order)
    .map(({ value }) => value);
}

function cellKey(x, z) {
  return `${x},${z}`;
}

function isDoorApproachCell(room, x, z, halfGrid) {
  return Object.keys(room.doors).some((direction) => {
    if (direction === RoomDirection.NORTH) return z <= -halfGrid + 2 && Math.abs(x) <= 1;
    if (direction === RoomDirection.SOUTH) return z >= halfGrid - 2 && Math.abs(x) <= 1;
    if (direction === RoomDirection.WEST) return x <= -halfGrid + 2 && Math.abs(z) <= 1;
    return x >= halfGrid - 2 && Math.abs(z) <= 1;
  });
}

/** 돌을 제외한 모든 격자 칸이 중앙에서 4방향으로 연결되는지 검사한다. */
export function isRoomRockLayoutWalkable(room, rocks) {
  const halfGrid = Math.floor(ROOM_GRID_SIZE / 2);
  const blocked = new Set(rocks.map((rock) => cellKey(rock.x, rock.z)));
  const start = blocked.has(cellKey(0, 0)) ? null : { x: 0, z: 0 };
  if (!start) return false;

  const queue = [start];
  const visited = new Set([cellKey(start.x, start.z)]);
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index];
    for (const offset of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
      const x = cell.x + offset.x;
      const z = cell.z + offset.z;
      const key = cellKey(x, z);
      if (Math.abs(x) > halfGrid || Math.abs(z) > halfGrid || blocked.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push({ x, z });
    }
  }

  const walkableCellCount = ROOM_GRID_SIZE ** 2 - blocked.size;
  const doorsRemainOpen = Object.keys(room.doors).every((direction) => {
    const doorCell = {
      [RoomDirection.NORTH]: { x: 0, z: -halfGrid },
      [RoomDirection.SOUTH]: { x: 0, z: halfGrid },
      [RoomDirection.WEST]: { x: -halfGrid, z: 0 },
      [RoomDirection.EAST]: { x: halfGrid, z: 0 },
    }[direction];
    return visited.has(cellKey(doorCell.x, doorCell.z));
  });
  return doorsRemainOpen && visited.size === walkableCellCount;
}

function rockGroupSizes(total, random) {
  const groups = [];
  let remaining = total;
  while (remaining > 0) {
    const candidates = [2, 3].filter((size) => size <= remaining && remaining - size !== 1);
    const size = pickRandom(candidates, random);
    groups.push(size);
    remaining -= size;
  }
  return groups;
}

function createRoomRocks(room, random) {
  const cells = [];
  const doorDirections = new Set(Object.keys(room.doors));
  const halfGrid = Math.floor(ROOM_GRID_SIZE / 2);
  const startDirection = room.type === "start" ? Object.keys(room.doors)[0] : null;
  for (let row = 0; row < ROOM_GRID_SIZE; row += 1) {
    for (let column = 0; column < ROOM_GRID_SIZE; column += 1) {
      const x = column - halfGrid;
      const z = row - halfGrid;
      const nearCenter = Math.abs(x) <= 1 && Math.abs(z) <= 1;
      const blocksNpcOrStartPath = room.type === "start" && (
        (startDirection === RoomDirection.NORTH && Math.abs(x) <= 1 && z <= 0)
        || (startDirection === RoomDirection.SOUTH && Math.abs(x) <= 1 && z >= 0)
        || (startDirection === RoomDirection.WEST && Math.abs(z) <= 1 && x <= 0)
        || (startDirection === RoomDirection.EAST && Math.abs(z) <= 1 && x >= 0)
      );
      const startOffset = startDirection ? DIRECTION_DATA[startDirection] : null;
      const blocksStartSpawn = room.type === "start" && startOffset && Math.hypot(
        x + startOffset.x * 2,
        z + startOffset.y * 2,
      ) < 1.6;
      const blocksDoor = doorDirections.size > 0 && isDoorApproachCell(room, x, z, halfGrid);
      const blocksStagePortal = room.isStageEnd && STAGE_END_PORTALS.some((portal) => (
        Math.hypot(x - portal.x, z - portal.z) < portal.radius + 1
      ));
      if (!nearCenter && !blocksNpcOrStartPath && !blocksStartSpawn && !blocksDoor && !blocksStagePortal) {
        cells.push({ x, z });
      }
    }
  }

  const available = new Map(cells.map((cell) => [cellKey(cell.x, cell.z), cell]));
  const targetCount = 6 + Math.floor(random() * 5);
  const rocks = [];
  const neighborOffsets = [
    { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
    { x: 1, z: 1 }, { x: -1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: -1 },
  ];

  for (const [groupIndex, groupSize] of rockGroupSizes(targetCount, random).entries()) {
    let groupCells = null;
    for (const anchor of shuffled([...available.values()], random)) {
      const neighbors = shuffled(neighborOffsets, random)
        .map((offset) => available.get(cellKey(anchor.x + offset.x, anchor.z + offset.z)))
        .filter(Boolean);
      if (neighbors.length >= groupSize - 1) {
        const candidateGroup = [anchor, ...neighbors.slice(0, groupSize - 1)];
        const candidateRocks = [...rocks, ...candidateGroup];
        if (isRoomRockLayoutWalkable(room, candidateRocks)) {
          groupCells = candidateGroup;
          break;
        }
      }
    }
    if (!groupCells) {
      throw new Error("돌 무리를 배치할 연속된 격자 칸을 찾지 못했습니다.");
    }
    for (const cell of groupCells) {
      available.delete(cellKey(cell.x, cell.z));
      rocks.push({
        id: `${room.id}-rock-${rocks.length}`,
        groupId: `${room.id}-rock-group-${groupIndex}`,
        ...cell,
        radius: 0.5,
      });
    }
    // 다음 돌 무리는 한 칸 이상 떨어뜨려 화면에서 4개 이상의 한 덩어리로 합쳐 보이지 않게 한다.
    for (const cell of groupCells) {
      for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          available.delete(cellKey(cell.x + offsetX, cell.z + offsetZ));
        }
      }
    }
  }
  return rocks;
}

function findStageEndRoom(rooms, startRoom) {
  const distanceById = new Map([[startRoom.id, 0]]);
  const queue = [startRoom];
  for (let index = 0; index < queue.length; index += 1) {
    const room = queue[index];
    for (const nextRoomId of Object.values(room.doors)) {
      if (distanceById.has(nextRoomId)) continue;
      distanceById.set(nextRoomId, distanceById.get(room.id) + 1);
      queue.push(rooms.find((candidate) => candidate.id === nextRoomId));
    }
  }
  return rooms
    .filter((room) => room.type === "combat")
    .sort((left, right) => (
      (distanceById.get(right.id) ?? 0) - (distanceById.get(left.id) ?? 0)
      || Object.keys(left.doors).length - Object.keys(right.doors).length
    ))[0];
}

/**
 * 시작방에서 가지가 뻗는 아이작식 격자 던전을 만든다.
 * 시작방은 최초 연결 외의 인접 좌표를 금지해 출구가 정확히 하나가 되도록 한다.
 */
export function generateDungeon({ random = Math.random, minimumRooms = 8, maximumRooms = 10 } = {}) {
  if (minimumRooms < 2 || maximumRooms < minimumRooms) {
    throw new Error("방 개수 범위가 올바르지 않습니다.");
  }

  const roomCount = minimumRooms + Math.floor(random() * (maximumRooms - minimumRooms + 1));
  const firstDirection = pickRandom(DIRECTIONS, random);
  const firstOffset = DIRECTION_DATA[firstDirection];
  const rooms = [
    { id: "room-0", x: 0, y: 0, type: "start", doors: {} },
    { id: "room-1", x: firstOffset.x, y: firstOffset.y, type: "combat", doors: {} },
  ];
  const occupied = new Map(rooms.map((room) => [coordinateKey(room.x, room.y), room]));
  const forbiddenStartNeighbors = new Set(
    DIRECTIONS
      .filter((direction) => direction !== firstDirection)
      .map((direction) => {
        const offset = DIRECTION_DATA[direction];
        return coordinateKey(offset.x, offset.y);
      }),
  );

  while (rooms.length < roomCount) {
    const parents = shuffled(rooms.slice(1), random);
    let createdRoom = null;

    for (const parent of parents) {
      for (const direction of shuffled(DIRECTIONS, random)) {
        const offset = DIRECTION_DATA[direction];
        const x = parent.x + offset.x;
        const y = parent.y + offset.y;
        const key = coordinateKey(x, y);
        if (occupied.has(key) || forbiddenStartNeighbors.has(key)) {
          continue;
        }

        createdRoom = {
          id: `room-${rooms.length}`,
          x,
          y,
          type: "combat",
          doors: {},
        };
        rooms.push(createdRoom);
        occupied.set(key, createdRoom);
        break;
      }
      if (createdRoom) {
        break;
      }
    }

    if (!createdRoom) {
      throw new Error("절차 생성 중 배치 가능한 방을 찾지 못했습니다.");
    }
  }

  for (const room of rooms) {
    for (const direction of DIRECTIONS) {
      const offset = DIRECTION_DATA[direction];
      const neighbor = occupied.get(coordinateKey(room.x + offset.x, room.y + offset.y));
      if (neighbor) {
        room.doors[direction] = neighbor.id;
      }
    }
  }

  const startRoom = rooms[0];
  startRoom.campfire = { id: `${startRoom.id}-campfire`, x: 0, y: 0, z: 0, radius: 0.82 };
  const stageEndRoom = findStageEndRoom(rooms, startRoom);
  stageEndRoom.isStageEnd = true;
  stageEndRoom.stagePortals = STAGE_END_PORTALS.map((portal) => ({ ...portal }));
  for (const room of rooms) {
    room.rocks = createRoomRocks(room, random);
  }
  return {
    rooms,
    roomById: Object.fromEntries(rooms.map((room) => [room.id, room])),
    startRoomId: startRoom.id,
    startDoorDirection: Object.keys(startRoom.doors)[0],
    stageEndRoomId: stageEndRoom.id,
  };
}

/** 보스 노드는 일반 전투 지도 끝에 상점방 하나와 단독 연결된 보스방을 덧붙인다. */
export function generateBossDungeon(options = {}) {
  const dungeon = generateDungeon(options);
  const occupied = new Set(dungeon.rooms.map((room) => coordinateKey(room.x, room.y)));
  let shopRoom = dungeon.roomById[dungeon.stageEndRoomId];
  let bossDirection = DIRECTIONS.find((direction) => {
    const offset = DIRECTION_DATA[direction];
    return !occupied.has(coordinateKey(shopRoom.x + offset.x, shopRoom.y + offset.y));
  });

  if (!bossDirection) {
    shopRoom = [...dungeon.rooms]
      .reverse()
      .find((room) => room.type === "combat" && DIRECTIONS.some((direction) => {
        const offset = DIRECTION_DATA[direction];
        return !occupied.has(coordinateKey(room.x + offset.x, room.y + offset.y));
      }));
    bossDirection = DIRECTIONS.find((direction) => {
      const offset = DIRECTION_DATA[direction];
      return !occupied.has(coordinateKey(shopRoom.x + offset.x, shopRoom.y + offset.y));
    });
  }

  for (const room of dungeon.rooms) {
    delete room.isStageEnd;
    delete room.stagePortals;
  }
  shopRoom.type = "shop";
  shopRoom.rocks = [];
  const offset = DIRECTION_DATA[bossDirection];
  shopRoom.campfire = {
    id: `${shopRoom.id}-campfire`,
    x: 0,
    y: 0,
    z: 0,
    radius: 0.82,
    spawnFacing: bossDirection,
  };
  const bossRoom = {
    id: `room-${dungeon.rooms.length}`,
    x: shopRoom.x + offset.x,
    y: shopRoom.y + offset.y,
    type: "boss",
    isBossRoom: true,
    doors: { [offset.opposite]: shopRoom.id },
    rocks: [],
  };
  shopRoom.doors[bossDirection] = bossRoom.id;
  dungeon.rooms.push(bossRoom);
  dungeon.roomById[bossRoom.id] = bossRoom;
  dungeon.stageEndRoomId = null;
  dungeon.shopRoomId = shopRoom.id;
  dungeon.bossRoomId = bossRoom.id;
  return dungeon;
}
