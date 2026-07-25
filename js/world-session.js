import { DIRECTION_DATA, ROOM_GRID_SIZE } from "./dungeon-generator.js";
import { copyProgressToPlayer, createPlayerProgress } from "./player-resources.js";

export const ROOM_HALF_SIZE = ROOM_GRID_SIZE / 2;
export const PLAYER_WORLD_HEIGHT = 2;
export const NPC_WORLD_HEIGHT = 1.6;
export const DOOR_WORLD_WIDTH = 0.9;
export const DOOR_WORLD_HEIGHT = PLAYER_WORLD_HEIGHT * 1.05;
const DOOR_HALF_WIDTH = DOOR_WORLD_WIDTH / 2;
export const PLAYER_SPEED_TEMPORARY = 3.6;
const PLAYER_COLLISION_RADIUS = 0.25;

const DIRECTION_YAW = Object.freeze({
  north: 0,
  east: Math.PI / 2,
  south: Math.PI,
  west: -Math.PI / 2,
});

function directionVector(direction) {
  const offset = DIRECTION_DATA[direction];
  return { x: offset.x, z: offset.y };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function hasKoreanBatchim(text) {
  const code = String(text).trim().codePointAt(String(text).trim().length - 1);
  return Number.isFinite(code) && code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

export function createGuideDialogues({ nickname = "마법사", handRolesReversed = false } = {}) {
  const triggerHand = handRolesReversed ? "오른손" : "왼손";
  const drawingHand = handRolesReversed ? "왼손" : "오른손";
  const vocative = hasKoreanBatchim(nickname) ? "이여" : "여";
  return [
    `제자 ${nickname}${vocative}, 마침내 떠날 때가 왔구나.`,
    "마지막으로, 전투에서 꼭 기억해야 할 것만 알려주마.",
    "양손을 활짝 펴면 룬을 그릴 준비가 된다네.",
    "룬을 준비하면 가장 가까운 적을 자동으로 바라보게 될 걸세.",
    `${triggerHand}을 주먹 쥔 동안 ${drawingHand} 검지가 움직인 자리에 룬이 새겨진다네.`,
    `룬을 완성한 뒤 ${drawingHand}을 주먹 쥐면 마법이 발동하지.`,
    `마법 카드는 ${drawingHand} 검지로 잠시 가리켜 선택할 수 있다네.`,
    "빠르고 정확하게 그릴수록 적은 마나로 강한 마법을 사용할 수 있네.",
    "하지만 마나가 30 이하라면 새로운 마법을 준비할 수 없으니 조심하게.",
    "쓰러지더라도 모닥불의 불꽃이 자네를 다시 일으켜 줄 걸세.",
    "타락한 정령왕을 멈추고, 숲이 잃어버린 빛을 되찾아다오.",
    "무사히 돌아오너라. 나의 자랑스러운 제자여.",
  ];
}

function cameraVectors(yaw) {
  return {
    forward: { x: Math.sin(yaw), z: -Math.cos(yaw) },
    right: { x: Math.cos(yaw), z: Math.sin(yaw) },
  };
}

function isBlockedByRock(room, x, z) {
  return (room.rocks ?? []).some((rock) => (
    Math.abs(x - rock.x) < 0.5 + PLAYER_COLLISION_RADIUS
    && Math.abs(z - rock.z) < 0.5 + PLAYER_COLLISION_RADIUS
  ));
}

/** 시작 시 플레이어, 출구 방향, NPC 배치를 확정한다. */
export function createWorldSession(dungeon, {
  playerProgress = createPlayerProgress(),
  handRolesReversed = false,
  showNpc = true,
} = {}) {
  const facing = dungeon.startDoorDirection;
  const forward = directionVector(facing);
  const spawnX = -forward.x * 2;
  const spawnZ = -forward.z * 2;
  const player = copyProgressToPlayer(playerProgress, {
    x: spawnX,
    z: spawnZ,
    facing,
    facingYaw: DIRECTION_YAW[facing],
    cameraYaw: DIRECTION_YAW[facing],
    height: PLAYER_WORLD_HEIGHT,
    assetKey: "player",
  });
  return {
    currentRoomId: dungeon.startRoomId,
    visitedRoomIds: new Set([dungeon.startRoomId]),
    spawnPoint: {
      roomId: dungeon.startRoomId,
      x: spawnX,
      z: spawnZ,
      facing,
      facingYaw: DIRECTION_YAW[facing],
      cameraYaw: DIRECTION_YAW[facing],
    },
    player,
    npc: {
      id: "guide-npc",
      name: "스승 그리모어",
      roomId: dungeon.startRoomId,
      x: forward.x * 4,
      z: forward.z * 4,
      height: NPC_WORLD_HEIGHT,
      dialogues: createGuideDialogues({
        nickname: playerProgress.nickname,
        handRolesReversed,
      }),
      assetKey: "npc.guide",
      active: showNpc,
    },
    npcNearby: false,
    lastWorldEvent: null,
  };
}

function tryRoomTransition(session, dungeon, nextX, nextZ, canLeaveCurrentRoom) {
  const room = dungeon.roomById[session.currentRoomId];
  let direction = null;
  let perpendicular = 0;

  if (nextZ < -ROOM_HALF_SIZE) {
    direction = "north";
    perpendicular = nextX;
  } else if (nextX > ROOM_HALF_SIZE) {
    direction = "east";
    perpendicular = nextZ;
  } else if (nextZ > ROOM_HALF_SIZE) {
    direction = "south";
    perpendicular = nextX;
  } else if (nextX < -ROOM_HALF_SIZE) {
    direction = "west";
    perpendicular = nextZ;
  }

  if (!direction) {
    return { transitioned: false, x: nextX, z: nextZ };
  }

  const nextRoomId = room.doors[direction];
  if (!nextRoomId || Math.abs(perpendicular) > DOOR_HALF_WIDTH) {
    return {
      transitioned: false,
      x: clamp(nextX, -ROOM_HALF_SIZE + PLAYER_COLLISION_RADIUS, ROOM_HALF_SIZE - PLAYER_COLLISION_RADIUS),
      z: clamp(nextZ, -ROOM_HALF_SIZE + PLAYER_COLLISION_RADIUS, ROOM_HALF_SIZE - PLAYER_COLLISION_RADIUS),
    };
  }

  if (!canLeaveCurrentRoom(room)) {
    session.lastWorldEvent = { type: "door-locked", roomId: room.id, direction };
    return {
      transitioned: false,
      x: clamp(nextX, -ROOM_HALF_SIZE + PLAYER_COLLISION_RADIUS, ROOM_HALF_SIZE - PLAYER_COLLISION_RADIUS),
      z: clamp(nextZ, -ROOM_HALF_SIZE + PLAYER_COLLISION_RADIUS, ROOM_HALF_SIZE - PLAYER_COLLISION_RADIUS),
    };
  }

  const forward = directionVector(direction);
  session.currentRoomId = nextRoomId;
  session.visitedRoomIds.add(nextRoomId);
  session.player.facing = direction;
  session.player.facingYaw = DIRECTION_YAW[direction];
  session.player.cameraYaw = DIRECTION_YAW[direction];
  session.lastWorldEvent = { type: "room-transition", roomId: nextRoomId, direction };
  return {
    transitioned: true,
    x: -forward.x * (ROOM_HALF_SIZE - 0.6),
    z: -forward.z * (ROOM_HALF_SIZE - 0.6),
  };
}

/** 체력이 0이 되면 현재 전투 노드의 시작 지점으로 돌아가고 체력을 전부 회복한다. */
export function respawnPlayer(session) {
  const spawnPoint = session.spawnPoint;
  session.currentRoomId = spawnPoint.roomId;
  session.player.x = spawnPoint.x;
  session.player.z = spawnPoint.z;
  session.player.facing = spawnPoint.facing;
  session.player.facingYaw = spawnPoint.facingYaw;
  session.player.cameraYaw = spawnPoint.cameraYaw;
  session.player.health = session.player.maximumHealth;
  session.npcNearby = isNpcNearby(session);
  session.lastWorldEvent = { type: "player-respawn", roomId: spawnPoint.roomId };
  return session;
}

/** 캠프파이어를 기준으로 다음 방을 바라보는 안전한 위치를 새 스폰포인트로 저장한다. */
export function saveCampfireSpawnPoint(session, room) {
  if (!session || !room?.campfire) return null;
  const facing = room.campfire.spawnFacing
    ?? Object.keys(room.doors ?? {})[0]
    ?? session.player.facing
    ?? "north";
  const forward = directionVector(facing);
  const spawnPoint = {
    roomId: room.id,
    x: room.campfire.x - forward.x * 2,
    z: room.campfire.z - forward.z * 2,
    facing,
    facingYaw: DIRECTION_YAW[facing],
    cameraYaw: DIRECTION_YAW[facing],
  };
  session.spawnPoint = spawnPoint;
  session.player.x = spawnPoint.x;
  session.player.z = spawnPoint.z;
  session.player.facing = spawnPoint.facing;
  session.player.facingYaw = spawnPoint.facingYaw;
  session.player.cameraYaw = spawnPoint.cameraYaw;
  session.lastWorldEvent = { type: "spawn-point-saved", roomId: room.id };
  return spawnPoint;
}

/** 완료방의 열린 통로 안에 들어갔는지 확인한다. */
export function findEnteredStagePortal(session, room, roomCleared) {
  if (!room?.isStageEnd || !roomCleared) return null;
  return (room.stagePortals ?? []).find((portal) => (
    Math.hypot(session.player.x - portal.x, session.player.z - portal.z) <= portal.radius
  )) ?? null;
}

/** 연속적인 입력량을 카메라 회전각에 반영한다. */
export function rotateWorldCamera(session, radians) {
  session.player.cameraYaw = normalizeAngle(session.player.cameraYaw + radians);
  return session.player.cameraYaw;
}

/** 화면 이동 벡터를 카메라 방향 기준으로 반영하고 문을 통과하면 방을 바꾼다. */
export function updateWorldSession(
  session,
  dungeon,
  sceneInput,
  elapsedMs,
  { canLeaveCurrentRoom = () => true } = {},
) {
  if (sceneInput.cameraTurn) {
    rotateWorldCamera(session, sceneInput.cameraTurn);
  }
  if (!sceneInput.isMoving) {
    session.npcNearby = isNpcNearby(session);
    return session;
  }

  const { forward, right } = cameraVectors(session.player.cameraYaw);
  const seconds = Math.min(elapsedMs, 100) / 1000;
  const localForward = -(sceneInput.moveVector.y ?? 0);
  const localRight = sceneInput.moveVector.x ?? 0;
  const distance = PLAYER_SPEED_TEMPORARY * seconds;
  const velocityX = (forward.x * localForward + right.x * localRight) * distance;
  const velocityZ = (forward.z * localForward + right.z * localRight) * distance;
  if (Math.hypot(velocityX, velocityZ) > 0.001) {
    session.player.facingYaw = Math.atan2(velocityX, -velocityZ);
  }
  const room = dungeon.roomById[session.currentRoomId];
  const candidateX = session.player.x + velocityX;
  const nextX = isBlockedByRock(room, candidateX, session.player.z) ? session.player.x : candidateX;
  const candidateZ = session.player.z + velocityZ;
  const nextZ = isBlockedByRock(room, nextX, candidateZ) ? session.player.z : candidateZ;
  const position = tryRoomTransition(session, dungeon, nextX, nextZ, canLeaveCurrentRoom);
  session.player.x = position.x;
  session.player.z = position.z;
  session.npcNearby = isNpcNearby(session);
  return session;
}

export function isNpcNearby(session) {
  if (!session.npc?.active) return false;
  if (session.currentRoomId !== session.npc.roomId) {
    return false;
  }

  return Math.hypot(session.player.x - session.npc.x, session.player.z - session.npc.z) <= 2.4;
}
