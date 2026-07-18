import { ROOM_GRID_SIZE } from "./dungeon-generator.js";
import { getElementRelation } from "./element-matchup.js";
import { addUltimateFromDamage } from "./player-resources.js";
import { createMonsterInstance, getMonsterTemplates } from "./monster-catalog.js";

const ROOM_HALF_SIZE = ROOM_GRID_SIZE / 2;
const MONSTER_WALL_MARGIN = 0.42;
const PLAYER_PROJECTILE_SPEED = 9.6;
const ENEMY_PROJECTILE_SPEED = 2.9;
const RANGED_ATTACK_INTERVAL_MS = 2600;
const ATTACK_PREPARE_MS = 1000;
const SLIME_HOP_WAIT_MS = 300;
const SLIME_HOP_DURATION_MS = 520;
const SLIME_CONTACT_RADIUS = 0.35;
export const MONSTER_AWARENESS_RADIUS = 7;
export const MONSTER_ROOM_ENTRY_GRACE_MS = 1000;
export const MONSTER_DETECTION_ALERT_MS = 650;
const ROCK_CAST_DISTANCE = 4.2;
export const PLAYER_PROJECTILE_HIT_RADIUS = 0.78;
export const DEFENSE_BARRIER_DURATION_MS = 3000;
export const DEFENSE_BASE_DAMAGE_MULTIPLIER = 0.7;
export const DEFENSE_ELEMENT_DAMAGE_MULTIPLIER = 0.5;
export const IMMOBILIZE_DURATION_MS = 2000;
export const SECOND_SKILL_ICE_IMMOBILIZE_DURATION_MS = 3000;
export const ROCK_WARNING_DURATION_MS = 1000;
export const BOSS_ROCK_WARNING_DURATION_MS = ROCK_WARNING_DURATION_MS + 1000;
export const ROCK_AREA_RADIUS = 2.5;
export const SECOND_SKILL_ROCK_RADIUS = 5;
export const BOSS_MELEE_PREPARE_MS = 2000;
export const BOSS_MELEE_RANGE = 16;
export const MAGIC_CIRCLE_DURATION_MS = 1800;
export const MELEE_ATTACK_RANGE_MULTIPLIER = 1.35;
export const MELEE_MOVE_SPEED_MULTIPLIER = 1.5;
export const PARTICLE_LIFETIME_MULTIPLIER = 1.8;
export const PARTICLE_SIZE_MULTIPLIER = 1.6;
export const BOSS_SUMMON_WARNING_MS = 1200;
export const BOSS_PHASE_TWO_HEALTH = 1500;
export const ULTIMATE_FIELD_DURATION_MS = 10000;
export const ULTIMATE_FIELD_RADIUS = 2.5;
export const ULTIMATE_FIELD_DAMAGE = 7.5;
export const ULTIMATE_FIELD_TICK_MS = 100;

export function isBossPhaseTwo(monster) {
  return Boolean(monster?.isBoss && (monster.currentHealth ?? monster.stats?.health ?? Infinity) <= BOSS_PHASE_TWO_HEALTH);
}

export function getEnemyTimeScaleForInputMode(mode, { isBoss = false, isUltimate = false } = {}) {
  if (isUltimate && mode !== "exploring") return 0;
  if (mode === "drawing") return isBoss ? 0.25 : 0;
  if (mode === "exploring") return 1;
  return 0.5;
}

export const MonsterState = Object.freeze({
  IDLE: "idle",
  WALKING: "walking",
  ATTACK_PREPARING: "attack-preparing",
  ATTACKING: "attacking",
});

export const ELEMENT_PRESENTATION = Object.freeze({
  normal: { label: "노말", color: "#d7e4ee", glow: false, shape: "circle", blendMode: "source-over" },
  rock: { label: "바위", color: "#c28762", glow: false, shape: "square", blendMode: "source-over" },
  water: { label: "물", color: "#4f7dff", glow: false, shape: "circle", blendMode: "source-over" },
  light: { label: "빛", color: "#fff2a2", glow: true, shape: "four-point-star", blendMode: "lighter" },
  fire: { label: "불", color: "#ff8a24", glow: true, shape: "square", blendMode: "lighter" },
  electric: { label: "전기", color: "#ffd62e", glow: true, shape: "circle", blendMode: "lighter" },
  dark: { label: "어둠", color: "#a27cff", glow: false, shape: "circle", blendMode: "multiply" },
  grass: { label: "풀", color: "#45dc77", glow: false, shape: "leaf", blendMode: "source-over" },
  ice: { label: "얼음", color: "#4dbcf7", glow: false, shape: "triangle", blendMode: "source-over" },
});

export function getElementDisplayName(element) {
  return ELEMENT_PRESENTATION[element]?.label ?? element;
}

/** 30% 이하는 실패하고, 성공 시 100점에서 1% 부족할 때마다 0.5 피해가 감소한다. */
export function calculateRuneDamage(accuracy, maximumDamage = 100) {
  const normalizedAccuracy = Math.max(0, Math.min(100, Number(accuracy) || 0));
  if (normalizedAccuracy <= 30) return 0;
  const normalizedMaximum = Math.max(0, Number(maximumDamage) || 0);
  return Math.round((normalizedMaximum - (100 - normalizedAccuracy) * normalizedMaximum * 0.005) * 10) / 10;
}

export function getMonsterHitboxRadius(monster) {
  return Math.max(0.12, monster.stats.size * 0.32 * (monster.hitboxScale ?? 1));
}

export function getMeleeAttackRange(monster) {
  return monster.isBoss ? BOSS_MELEE_RANGE : monster.stats.attackRange * MELEE_ATTACK_RANGE_MULTIPLIER;
}

export function createCombatState() {
  return {
    nextProjectileId: 1,
    nextGoldDropId: 1,
    nextHeartDropId: 1,
    nextDamageNumberId: 1,
    nextSummonId: 1,
    projectiles: [],
    lasers: [],
    verticalLightnings: [],
    particles: [],
    castEffects: [],
    groundMagicCircles: [],
    areaAttacks: [],
    goldDrops: [],
    heartDrops: [],
    damageNumbers: [],
    statusEffects: [],
    waves: [],
    blackHoles: [],
    meteors: [],
    trajectoryWarnings: [],
    blackFlames: [],
    ultimateFields: [],
    scheduledActions: [],
    soundEvents: [],
    roomEntryGraceMs: MONSTER_ROOM_ENTRY_GRACE_MS,
    lastEvent: null,
  };
}

export function clearCombatState(state) {
  state.projectiles.length = 0;
  state.lasers.length = 0;
  state.verticalLightnings.length = 0;
  state.particles.length = 0;
  state.castEffects.length = 0;
  state.groundMagicCircles.length = 0;
  state.areaAttacks.length = 0;
  state.goldDrops.length = 0;
  state.heartDrops.length = 0;
  state.damageNumbers.length = 0;
  state.statusEffects.length = 0;
  state.waves.length = 0;
  state.blackHoles.length = 0;
  state.meteors.length = 0;
  state.trajectoryWarnings.length = 0;
  state.blackFlames.length = 0;
  state.ultimateFields.length = 0;
  state.scheduledActions.length = 0;
  state.soundEvents.length = 0;
  state.roomEntryGraceMs = MONSTER_ROOM_ENTRY_GRACE_MS;
  state.lastEvent = null;
}

function queueSoundEvent(state, event) {
  state.soundEvents.push(event);
}

export function drainCombatSoundEvents(state) {
  return state.soundEvents.splice(0, state.soundEvents.length);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizedDirection(from, to) {
  const x = to.x - from.x;
  const z = to.z - from.z;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function isBlocked(room, x, z, radius = 0.32) {
  if (Math.abs(x) > ROOM_HALF_SIZE - MONSTER_WALL_MARGIN || Math.abs(z) > ROOM_HALF_SIZE - MONSTER_WALL_MARGIN) {
    return true;
  }
  return (room.rocks ?? []).some((rock) => (
    Math.abs(x - rock.x) < 0.5 + radius
    && Math.abs(z - rock.z) < 0.5 + radius
  ));
}

function segmentAxisIntersection(start, delta, minimum, maximum, interval) {
  if (Math.abs(delta) < 0.000001) {
    return start >= minimum && start <= maximum ? interval : null;
  }
  const first = (minimum - start) / delta;
  const second = (maximum - start) / delta;
  return {
    minimum: Math.max(interval.minimum, Math.min(first, second)),
    maximum: Math.min(interval.maximum, Math.max(first, second)),
  };
}

function findRockSegmentCollision(room, start, end, radius = 0) {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  let closest = null;
  for (const rock of room?.rocks ?? []) {
    const halfSize = 0.5 + radius;
    let interval = { minimum: 0, maximum: 1 };
    interval = segmentAxisIntersection(start.x, deltaX, rock.x - halfSize, rock.x + halfSize, interval);
    if (!interval) continue;
    interval = segmentAxisIntersection(start.z, deltaZ, rock.z - halfSize, rock.z + halfSize, interval);
    if (!interval || interval.minimum > interval.maximum || interval.maximum < 0 || interval.minimum > 1) continue;
    const amount = clamp(interval.minimum, 0, 1);
    if (!closest || amount < closest.amount) {
      closest = {
        amount,
        rock,
        x: start.x + deltaX * amount,
        z: start.z + deltaZ * amount,
      };
    }
  }
  return closest;
}

function moveAroundRocks(position, direction, distance, room) {
  const beforeX = position.x;
  const beforeZ = position.z;
  const candidateX = position.x + direction.x * distance;
  if (!isBlocked(room, candidateX, position.z)) position.x = candidateX;
  const candidateZ = position.z + direction.z * distance;
  if (!isBlocked(room, position.x, candidateZ)) position.z = candidateZ;
  return Math.hypot(position.x - beforeX, position.z - beforeZ);
}

function findGridPathDirection(position, target, room) {
  const halfGrid = Math.floor(ROOM_GRID_SIZE / 2);
  const key = (x, z) => `${x},${z}`;
  const blocked = new Set((room.rocks ?? []).map((rock) => key(rock.x, rock.z)));
  const start = { x: clamp(Math.round(position.x), -halfGrid, halfGrid), z: clamp(Math.round(position.z), -halfGrid, halfGrid) };
  const goal = { x: clamp(Math.round(target.x), -halfGrid, halfGrid), z: clamp(Math.round(target.z), -halfGrid, halfGrid) };
  const queue = [start];
  const parentByKey = new Map([[key(start.x, start.z), null]]);
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index];
    if (cell.x === goal.x && cell.z === goal.z) break;
    for (const offset of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
      const next = { x: cell.x + offset.x, z: cell.z + offset.z };
      const nextKey = key(next.x, next.z);
      if (Math.abs(next.x) > halfGrid || Math.abs(next.z) > halfGrid || blocked.has(nextKey) || parentByKey.has(nextKey)) continue;
      parentByKey.set(nextKey, cell);
      queue.push(next);
    }
  }
  if (!parentByKey.has(key(goal.x, goal.z))) return normalizedDirection(position, target);
  let step = goal;
  let parent = parentByKey.get(key(step.x, step.z));
  while (parent && !(parent.x === start.x && parent.z === start.z)) {
    step = parent;
    parent = parentByKey.get(key(step.x, step.z));
  }
  return normalizedDirection(position, step);
}

function navigateToward(position, target, direction, distance, room) {
  const directRock = findRockSegmentCollision(room, position, target, 0.3);
  const preferredDirection = directRock ? findGridPathDirection(position, target, room) : direction;
  const moved = moveAroundRocks(position, preferredDirection, distance, room);
  if (moved < distance * 0.18) {
    moveAroundRocks(position, findGridPathDirection(position, target, room), distance, room);
  }
  return moved;
}

function addParticles(state, source, count, { burst = false, random = Math.random } = {}) {
  const presentation = ELEMENT_PRESENTATION[source.element] ?? ELEMENT_PRESENTATION.normal;
  const scaledCount = Math.max(1, Math.round(count * (source.particleCountScale ?? 1)));
  for (let index = 0; index < scaledCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const speed = (burst ? 0.8 + random() * 2 : 0.08 + random() * 0.38)
      * (source.particleSpeedMultiplier ?? 1);
    const lifetimeMs = (burst ? 520 + random() * 380 : 360 + random() * 300)
      * PARTICLE_LIFETIME_MULTIPLIER * (source.particleLifetimeMultiplier ?? 1);
    const direction = source.direction ?? { x: 0, z: 0 };
    const spawnAngle = random() * Math.PI * 2;
    const spawnRadius = random() * (source.particleSpawnRadius ?? 0.07);
    state.particles.push({
      x: source.x + Math.cos(spawnAngle) * spawnRadius,
      y: source.y + (random() - 0.5) * 0.14,
      z: source.z + Math.sin(spawnAngle) * spawnRadius,
      velocityX: Math.cos(angle) * speed - direction.x * (burst ? 0 : 0.12),
      velocityY: source.particleUpwardSpeed ?? ((random() - 0.35) * (burst ? 1.5 : 0.3)),
      velocityZ: Math.sin(angle) * speed - direction.z * (burst ? 0 : 0.12),
      size: ((burst ? 0.018 : 0.008) + random() * (burst ? 0.025 : 0.015))
        * PARTICLE_SIZE_MULTIPLIER * (source.particleSizeMultiplier ?? 1),
      rotation: random() * Math.PI * 2,
      rotationSpeed: (random() - 0.5) * 5,
      color: source.particleColor ?? presentation.color,
      glow: presentation.glow,
      shape: source.particleShape ?? presentation.shape,
      blendMode: presentation.blendMode,
      opacity: source.particleOpacity ?? 1,
      lifeMs: lifetimeMs,
      maximumLifeMs: lifetimeMs,
    });
  }
}

function addDefenseAuraParticles(state, player, element, count, random = Math.random) {
  const presentation = ELEMENT_PRESENTATION[element] ?? ELEMENT_PRESENTATION.normal;
  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 0.28 + random() * 0.58;
    const lifetimeMs = 880 + random() * 620;
    const outwardSpeed = 0.08 + random() * 0.16;
    state.particles.push({
      x: player.x + Math.cos(angle) * radius,
      y: 0.22 + random() * 1.15,
      z: player.z + Math.sin(angle) * radius,
      velocityX: Math.cos(angle) * outwardSpeed,
      velocityY: 0.04 + random() * 0.12,
      velocityZ: Math.sin(angle) * outwardSpeed,
      size: (0.009 + random() * 0.012) * PARTICLE_SIZE_MULTIPLIER,
      rotation: random() * Math.PI * 2,
      rotationSpeed: (random() - 0.5) * 2.4,
      color: presentation.color,
      glow: presentation.glow,
      shape: presentation.shape,
      blendMode: presentation.blendMode,
      lifeMs: lifetimeMs,
      maximumLifeMs: lifetimeMs,
    });
  }
}

function addRockRoomEruptionParticles(state, roomId, random = Math.random) {
  for (let index = 0; index < 120; index += 1) {
    const lifeMs = 760 + random() * 620;
    state.particles.push({
      x: (random() - 0.5) * (ROOM_GRID_SIZE - 1),
      y: 0.03,
      z: (random() - 0.5) * (ROOM_GRID_SIZE - 1),
      roomId,
      velocityX: (random() - 0.5) * 0.45,
      velocityY: 0.9 + random() * 1.8,
      velocityZ: (random() - 0.5) * 0.45,
      size: (0.045 + random() * 0.065) * PARTICLE_SIZE_MULTIPLIER,
      rotation: random() * Math.PI * 2,
      rotationSpeed: (random() - 0.5) * 3,
      color: index % 3 === 0 ? "#9a6c52" : "#6e5a4f",
      glow: false,
      shape: "square",
      blendMode: "source-over",
      opacity: 0.92,
      lifeMs,
      maximumLifeMs: lifeMs,
    });
  }
}

function createProjectile(state, data) {
  const projectile = {
    id: `projectile-${state.nextProjectileId}`,
    y: 0.92,
    lifeMs: 2200,
    ...data,
  };
  state.nextProjectileId += 1;
  state.projectiles.push(projectile);
  addParticles(state, projectile, projectile.owner === "player" ? 28 : 16);
  return projectile;
}

function createDamageNumber(state, target, damage, owner, random = Math.random) {
  if (!state || damage <= 0) return null;
  const angle = Math.min(0.999999, Math.max(0, random())) * Math.PI * 2;
  const radius = 0.24 + Math.min(0.999999, Math.max(0, random())) * 0.62;
  const number = {
    id: `damage-${state.nextDamageNumberId}`,
    roomId: target.roomId,
    x: target.x + Math.cos(angle) * radius,
    y: (target.y ?? 0) + (target.height ?? 1.1) * (0.72 + Math.min(0.999999, Math.max(0, random())) * 0.34),
    z: target.z + Math.sin(angle) * radius,
    damage: Math.round(damage * 10) / 10,
    critical: damage >= 100,
    owner,
    lifeMs: 900,
    maximumLifeMs: 900,
  };
  state.nextDamageNumberId += 1;
  state.damageNumbers.push(number);
  return number;
}

function distanceToRoomBoundary(x, z, direction) {
  const distances = [];
  if (direction.x > 0.001) distances.push((ROOM_HALF_SIZE - x) / direction.x);
  if (direction.x < -0.001) distances.push((-ROOM_HALF_SIZE - x) / direction.x);
  if (direction.z > 0.001) distances.push((ROOM_HALF_SIZE - z) / direction.z);
  if (direction.z < -0.001) distances.push((-ROOM_HALF_SIZE - z) / direction.z);
  return Math.max(0.5, Math.min(...distances.filter((distance) => distance > 0)) - 0.1);
}

function distanceToMagicObstacle(x, z, direction, room) {
  const boundaryDistance = distanceToRoomBoundary(x, z, direction);
  const collision = findRockSegmentCollision(room, { x, z }, {
    x: x + direction.x * boundaryDistance,
    z: z + direction.z * boundaryDistance,
  }, 0.06);
  return collision
    ? Math.max(0.12, boundaryDistance * collision.amount - 0.06)
    : boundaryDistance;
}

function pointAlongLaser(laser, amount) {
  const side = { x: -laser.direction.z, z: laser.direction.x };
  const offset = laser.isLightning && amount > 0 && amount < 1
    ? Math.sin(amount * Math.PI * 13) * 0.2 + Math.sin(amount * Math.PI * 29) * 0.08
    : 0;
  return {
    x: laser.x + laser.direction.x * laser.length * amount + side.x * offset,
    y: laser.y,
    z: laser.z + laser.direction.z * laser.length * amount + side.z * offset,
  };
}

function addLaserAfterimage(state, laser, random = Math.random) {
  const count = laser.sustained ? 8 : laser.skillTier === 2 ? 18 : laser.isLightning ? 36 : 32;
  for (let index = 0; index < count; index += 1) {
    const amount = index / (count - 1);
    const point = pointAlongLaser(laser, amount);
    addParticles(state, {
      x: point.x,
      y: laser.y + (random() - 0.5) * 0.05,
      z: point.z,
      direction: laser.direction,
      element: laser.element,
      particleLifetimeMultiplier: laser.element === "light" ? 2.5 : 1.65,
      particleCountScale: laser.skillTier === 2 ? 0.7 : 1,
    }, 1, { random });
  }
}

function createMagicCircle(state, { session, element, direction, runeStrokes }) {
  const effect = {
    x: session.player.x,
    y: 0.92,
    z: session.player.z,
    direction,
    element,
    runeStrokes,
    lifeMs: MAGIC_CIRCLE_DURATION_MS,
    maximumLifeMs: MAGIC_CIRCLE_DURATION_MS,
  };
  state.castEffects.push(effect);
  return effect;
}

function createRockAreaAttack(state, session, direction, damage, { skillTier = 1 } = {}) {
  const effect = {
    id: `area-${state.nextProjectileId}`,
    type: "rock-quake",
    roomId: session.currentRoomId,
    x: session.player.x + direction.x * ROCK_CAST_DISTANCE,
    y: 0.02,
    z: session.player.z + direction.z * ROCK_CAST_DISTANCE,
    radius: skillTier === 2 ? SECOND_SKILL_ROCK_RADIUS : ROCK_AREA_RADIUS,
    damage,
    element: "rock",
    owner: "player",
    warningMs: ROCK_WARNING_DURATION_MS,
    maximumWarningMs: ROCK_WARNING_DURATION_MS,
    quakeMs: 420,
    triggered: false,
    immobilizeMs: skillTier === 2 ? IMMOBILIZE_DURATION_MS : 0,
    removesRocks: skillTier === 2,
  };
  state.nextProjectileId += 1;
  state.areaAttacks.push(effect);
  return effect;
}

function radialDirections(count, yaw = 0) {
  return Array.from({ length: count }, (_, index) => {
    const angle = yaw + index / count * Math.PI * 2;
    return { x: Math.sin(angle), z: -Math.cos(angle) };
  });
}

function addMonsterStatusEffect(state, session, monster, effect) {
  const existing = state.statusEffects.find((candidate) => (
    candidate.targetId === monster.id && candidate.type === effect.type
  ));
  const status = {
    roomId: session.currentRoomId,
    targetId: monster.id,
    remainingMs: effect.durationMs,
    tickEveryMs: effect.tickEveryMs,
    tickTimerMs: effect.tickEveryMs,
    particleTimerMs: 0,
    ...effect,
  };
  if (existing) Object.assign(existing, status);
  else state.statusEffects.push(status);
  return existing ?? status;
}

function createPlayerLaser(state, session, room, origin, direction, element, damage, options = {}) {
  const laser = {
    id: `laser-${state.nextProjectileId}`,
    owner: "player",
    roomId: session.currentRoomId,
    x: origin.x,
    y: origin.y,
    z: origin.z,
    direction,
    length: options.length ?? distanceToMagicObstacle(origin.x, origin.z, direction, room),
    damage,
    element,
    lifeMs: options.lifeMs ?? 560,
    maximumLifeMs: options.lifeMs ?? 560,
    piercing: options.piercing ?? true,
    isLightning: options.isLightning ?? false,
    skillTier: 3,
    hasHit: options.hasHit ?? false,
    sustained: options.sustained ?? false,
    trackingPlayer: options.trackingPlayer ?? false,
    hitWidth: options.hitWidth ?? 0.58,
    widthMultiplier: options.widthMultiplier ?? 1,
    tickEveryMs: options.tickEveryMs ?? 0,
    tickTimers: options.sustained ? new Map() : null,
    afterimageTimerMs: 0,
  };
  state.nextProjectileId += 1;
  state.lasers.push(laser);
  addLaserAfterimage(state, laser);
  return laser;
}

function spawnPlayerThirdSkill(state, session, element, {
  damage,
  room,
  monsters = [],
  origin,
  direction,
  random = Math.random,
} = {}) {
  if (element === "normal") {
    return radialDirections(8, session.player.cameraYaw).map((projectileDirection) => createProjectile(state, {
      owner: "player",
      roomId: session.currentRoomId,
      x: origin.x,
      y: origin.y,
      z: origin.z,
      direction: projectileDirection,
      speed: PLAYER_PROJECTILE_SPEED,
      damage: damage * 1.15,
      element,
      particleSizeMultiplier: 2.8,
      particleCountScale: 0.5,
      hitRadiusScale: 2.2,
      skillTier: 3,
    }));
  }
  if (element === "fire") {
    const impactX = session.player.x + direction.x * 5;
    const impactZ = session.player.z + direction.z * 5;
    const effect = {
      id: `area-${state.nextProjectileId}`,
      type: "fire-meteor",
      roomId: session.currentRoomId,
      x: impactX,
      y: 0.02,
      z: impactZ,
      radius: 5,
      damage,
      element,
      owner: "player",
      warningMs: 1000,
      maximumWarningMs: 1000,
      quakeMs: 700,
      triggered: false,
      immobilizeMs: 0,
      removesRocks: false,
      dotEffect: { type: "burn", element: "fire", durationMs: 5000, tickEveryMs: 500, damage: 12 },
    };
    state.nextProjectileId += 1;
    state.areaAttacks.push(effect);
    state.meteors.push({
      id: `meteor-${effect.id}`,
      roomId: session.currentRoomId,
      x: impactX - direction.x * 1.8,
      y: 6.2,
      z: impactZ - direction.z * 1.8,
      startX: impactX - direction.x * 1.8,
      startY: 6.2,
      startZ: impactZ - direction.z * 1.8,
      targetX: impactX,
      targetY: 0.58,
      targetZ: impactZ,
      lifeMs: 1000,
      maximumLifeMs: 1000,
      particleTimerMs: 0,
    });
    return effect;
  }
  if (element === "water") {
    const wave = {
      id: `wave-${state.nextProjectileId}`,
      roomId: session.currentRoomId,
      x: session.player.x - direction.x * 2.2,
      y: 0.2,
      z: session.player.z - direction.z * 2.2,
      direction,
      speed: 5.4,
      width: ROOM_GRID_SIZE,
      thickness: 1.35,
      damage,
      lifeMs: 3200,
      maximumLifeMs: 3200,
      hitIds: new Set(),
      carriedIds: new Set(),
      foamTimerMs: 0,
    };
    state.nextProjectileId += 1;
    state.waves.push(wave);
    return wave;
  }
  if (element === "grass") {
    const targets = monsters
      .filter((monster) => (monster.currentHealth ?? monster.stats.health) > 0)
      .sort((left, right) => (
        Math.hypot(left.position.x - session.player.x, left.position.z - session.player.z)
        - Math.hypot(right.position.x - session.player.x, right.position.z - session.player.z)
      )).slice(0, 3);
    for (const monster of targets) {
      immobilizeMonster(monster, 5000, "grass");
      if (monster.isBoss) monster.vineVisualMs = Math.max(monster.vineVisualMs ?? 0, 5000);
      addMonsterStatusEffect(state, session, monster, {
        type: "vine",
        element: "grass",
        durationMs: 5000,
        tickEveryMs: 300,
        damage: 15,
        immobilizes: !monster.isBoss,
      });
    }
    return targets;
  }
  if (element === "rock") {
    const effect = createRockAreaAttack(state, session, { x: 0, z: 0 }, damage, { skillTier: 2 });
    effect.x = 0;
    effect.z = 0;
    effect.radius = ROOM_GRID_SIZE;
    effect.type = "rock-room-quake";
    return effect;
  }
  if (element === "electric") {
    const targets = monsters
      .filter((monster) => (monster.currentHealth ?? monster.stats.health) > 0)
      .map((monster) => ({ monster, order: random() }))
      .sort((left, right) => left.order - right.order)
      .slice(0, 3)
      .map(({ monster }) => monster);
    const strikeDamage = damage * 1.5;
    for (const target of targets) {
      state.verticalLightnings.push({
        id: `vertical-lightning-${state.nextProjectileId}`,
        roomId: session.currentRoomId,
        x: target.position.x,
        y: (target.position.y ?? 0) + Math.max(0.5, target.stats.size * 0.45),
        z: target.position.z,
        topY: 5.8,
        element: "electric",
        lifeMs: 620,
        maximumLifeMs: 620,
        phase: random() * Math.PI * 2,
      });
      state.nextProjectileId += 1;
      damageMonster(state, session, target, strikeDamage, random, "electric", 3000);
      addParticles(state, {
        x: target.position.x,
        y: (target.position.y ?? 0) + 0.5,
        z: target.position.z,
        direction: { x: 0, z: 0 },
        element: "electric",
        particleSizeMultiplier: 1.55,
      }, 42, { burst: true, random });
    }
    return targets;
  }
  if (element === "ice") {
    const targets = monsters.filter((monster) => (monster.currentHealth ?? monster.stats.health) > 0);
    for (const monster of targets) damageMonster(state, session, monster, damage, random, "ice", 3000);
    return targets;
  }
  if (element === "light") {
    origin.lifeMs = 3000;
    origin.maximumLifeMs = 3000;
    origin.tracksPlayer = true;
    session.player.invulnerableMs = Math.max(session.player.invulnerableMs ?? 0, 3000);
    return createPlayerLaser(state, session, room, origin, direction, element, 20, {
      piercing: true,
      lifeMs: 3000,
      sustained: true,
      trackingPlayer: true,
      hitWidth: 1.35,
      widthMultiplier: 5.2,
      tickEveryMs: 100,
    });
  }
  if (element === "dark") {
    const blackHole = {
      id: `black-hole-${state.nextProjectileId}`,
      roomId: session.currentRoomId,
      x: session.player.x + direction.x * 5,
      y: 1.55,
      z: session.player.z + direction.z * 5,
      radius: 10,
      coreRadius: 1.25,
      lifeMs: 5000,
      maximumLifeMs: 5000,
      tickTimers: new Map(),
      particleTimerMs: 0,
    };
    state.nextProjectileId += 1;
    state.blackHoles.push(blackHole);
    return blackHole;
  }
  return null;
}

/** 마법은 플레이어 위치에서 시작하고 카메라가 바라보는 방향으로 조준한다. */
export function spawnPlayerMagic(state, session, element, {
  damage = 100,
  runeStrokes = [],
  room = null,
  skillTier = 1,
  monsters = [],
  random = Math.random,
} = {}) {
  const direction = {
    x: Math.sin(session.player.cameraYaw),
    z: -Math.cos(session.player.cameraYaw),
  };
  const origin = createMagicCircle(state, { session, element, direction, runeStrokes });
  if (skillTier === 3) {
    return spawnPlayerThirdSkill(state, session, element, {
      damage,
      room,
      monsters,
      origin,
      direction,
      random,
    });
  }
  if (element === "rock") {
    return createRockAreaAttack(state, session, direction, damage, { skillTier });
  }
  if (element === "light" || element === "electric") {
    const directions = skillTier === 2
      ? [direction, { x: -direction.z, z: direction.x }, { x: -direction.x, z: -direction.z }, { x: direction.z, z: -direction.x }]
      : [direction];
    const lasers = directions.map((laserDirection) => {
      const laser = {
        id: `laser-${state.nextProjectileId}`,
        owner: "player",
        roomId: session.currentRoomId,
        x: origin.x,
        y: origin.y,
        z: origin.z,
        direction: laserDirection,
        length: distanceToMagicObstacle(origin.x, origin.z, laserDirection, room),
        damage,
        element,
        lifeMs: element === "electric" ? 480 : 420,
        maximumLifeMs: element === "electric" ? 480 : 420,
        piercing: element === "light",
        isLightning: element === "electric",
        skillTier,
        statusDurationMs: element === "electric" ? IMMOBILIZE_DURATION_MS : 0,
        hasHit: false,
      };
      state.nextProjectileId += 1;
      state.lasers.push(laser);
      addLaserAfterimage(state, laser);
      return laser;
    });
    return skillTier === 2 ? lasers : lasers[0];
  }
  const projectileDirections = skillTier === 2
    ? [-0.18, 0, 0.18].map((angle) => ({
      x: direction.x * Math.cos(angle) - direction.z * Math.sin(angle),
      z: direction.x * Math.sin(angle) + direction.z * Math.cos(angle),
    }))
    : [direction];
  const projectiles = projectileDirections.map((projectileDirection) => createProjectile(state, {
      owner: "player",
      roomId: session.currentRoomId,
      x: origin.x,
      y: origin.y,
      z: origin.z,
      direction: projectileDirection,
      speed: PLAYER_PROJECTILE_SPEED,
      damage,
      element,
      particleSizeMultiplier: skillTier === 2 ? 1.65 : 1,
      particleCountScale: skillTier === 2 ? 0.42 : 1,
      hitRadiusScale: skillTier === 2 ? 1.45 : 1,
      skillTier,
      statusDurationMs: element === "ice"
        ? skillTier === 2 ? SECOND_SKILL_ICE_IMMOBILIZE_DURATION_MS : IMMOBILIZE_DURATION_MS
        : 0,
    }));
  return skillTier === 2 ? projectiles : projectiles[0];
}

/** 완성된 세 빛 룬을 플레이어 주변 5×5 공격장과 10초 강화 효과로 발현한다. */
export function spawnPlayerUltimate(state, session, completedRuneStrokes = []) {
  const field = {
    id: `ultimate-field-${state.nextProjectileId}`,
    roomId: session.currentRoomId,
    x: session.player.x,
    y: 0.025,
    z: session.player.z,
    radius: ULTIMATE_FIELD_RADIUS,
    lifeMs: ULTIMATE_FIELD_DURATION_MS,
    maximumLifeMs: ULTIMATE_FIELD_DURATION_MS,
    damage: ULTIMATE_FIELD_DAMAGE,
    tickEveryMs: ULTIMATE_FIELD_TICK_MS,
    tickTimers: new Map(),
    runeStrokes: completedRuneStrokes.map((rune) => rune.map((stroke) => stroke.map((point) => ({ ...point })))),
  };
  state.nextProjectileId += 1;
  state.ultimateFields.push(field);
  session.player.ultimate = 0;
  session.player.ultimateBuffMs = ULTIMATE_FIELD_DURATION_MS;
  return field;
}

/** 방어 마법은 공격을 발사하지 않고 플레이어를 3초 동안 속성 보호막으로 감싼다. */
export function spawnPlayerDefense(state, session, element, { runeStrokes = [] } = {}) {
  const direction = {
    x: Math.sin(session.player.cameraYaw),
    z: -Math.cos(session.player.cameraYaw),
  };
  createMagicCircle(state, { session, element, direction, runeStrokes });
  session.player.defenseBarrier = {
    element,
    remainingMs: DEFENSE_BARRIER_DURATION_MS,
    maximumMs: DEFENSE_BARRIER_DURATION_MS,
    particleTimerMs: 0,
  };
  addDefenseAuraParticles(state, session.player, element, 26);
  return session.player.defenseBarrier;
}

export function calculateIncomingPlayerDamage(player, requestedDamage, attackElement = "normal") {
  const rawDamage = Math.max(0, Number(requestedDamage) || 0);
  const barrier = player.defenseBarrier;
  let multiplier = (player.ultimateBuffMs ?? 0) > 0 ? 0.2 : 1;
  if (barrier && barrier.remainingMs > 0) {
    multiplier *= DEFENSE_BASE_DAMAGE_MULTIPLIER;
    if (getElementRelation(attackElement, barrier.element) === "disadvantage") {
      multiplier *= DEFENSE_ELEMENT_DAMAGE_MULTIPLIER;
    }
  }
  return Math.round(rawDamage * multiplier * 10) / 10;
}

function applyDamageToPlayer(session, requestedDamage, attackElement, state = null) {
  if ((session.player.invulnerableMs ?? 0) > 0) return 0;
  const damage = calculateIncomingPlayerDamage(session.player, requestedDamage, attackElement);
  if (!session.player.infiniteHealth) {
    session.player.health = Math.max(0, (session.player.health ?? 100) - damage);
  } else {
    session.player.health = session.player.maximumHealth ?? session.player.health ?? 100;
  }
  session.player.hitFlashMs = 220;
  createDamageNumber(state, {
    roomId: session.currentRoomId,
    x: session.player.x,
    y: session.player.y ?? 0,
    z: session.player.z,
    height: 1.45,
  }, damage, "enemy");
  return damage;
}

function spawnEnemyMagic(state, session, monster) {
  const direction = normalizedDirection(monster.position, session.player);
  const projectile = createProjectile(state, {
    owner: "enemy",
    sourceId: monster.id,
    roomId: session.currentRoomId,
    x: monster.position.x + direction.x * 0.4,
    y: (monster.position.y ?? 0) + 0.72,
    z: monster.position.z + direction.z * 0.4,
    direction,
    speed: ENEMY_PROJECTILE_SPEED,
    damage: monster.stats.attack,
    element: monster.element,
  });
  queueSoundEvent(state, {
    type: "magic-cast",
    owner: "enemy",
    element: monster.element,
    x: monster.position.x,
    z: monster.position.z,
  });
  return projectile;
}

const BOSS_SECOND_SKILL_ELEMENTS = Object.freeze(["water", "fire", "grass", "electric", "rock"]);
const BOSS_RADIAL_ELEMENTS = Object.freeze(["fire", "water", "grass"]);
const BOSS_PROJECTILE_HEIGHT = 0.82;

function createEnemyAreaAttack(state, session, monster, {
  element,
  x,
  z,
  radius,
  warningMs,
  damage,
  immobilizeMs = 2000,
  warningVisual = "area",
  releaseSoundType = null,
} = {}) {
  const attack = {
    id: `area-${state.nextProjectileId}`,
    type: `${element}-boss-quake`,
    roomId: session.currentRoomId,
    x,
    y: 0.02,
    z,
    radius,
    damage,
    element,
    owner: "enemy",
    sourceId: monster.id,
    warningMs,
    maximumWarningMs: warningMs,
    quakeMs: 520,
    triggered: false,
    immobilizeMs,
    removesRocks: true,
    warningVisual,
    releaseSoundType,
  };
  state.nextProjectileId += 1;
  state.areaAttacks.push(attack);
  return attack;
}

function spawnBossSecondSkill(state, session, room, boss, element, preparedDirections = null) {
  const direction = normalizedDirection(boss.position, session.player);
  queueSoundEvent(state, {
    type: "magic-cast",
    owner: "enemy",
    element,
    x: boss.position.x,
    z: boss.position.z,
  });
  if (element === "rock") {
    return createEnemyAreaAttack(state, session, boss, {
      element,
      x: session.player.x,
      z: session.player.z,
      radius: SECOND_SKILL_ROCK_RADIUS,
      warningMs: BOSS_ROCK_WARNING_DURATION_MS,
      damage: boss.stats.attack,
    });
  }
  if (element === "electric") {
    return (preparedDirections ?? [direction, { x: -direction.z, z: direction.x }, { x: -direction.x, z: -direction.z }, { x: direction.z, z: -direction.x }])
      .map((laserDirection) => {
        const laser = {
          id: `laser-${state.nextProjectileId}`,
          owner: "enemy",
          sourceId: boss.id,
          roomId: session.currentRoomId,
          x: boss.position.x,
          y: BOSS_PROJECTILE_HEIGHT,
          z: boss.position.z,
          direction: laserDirection,
          length: distanceToMagicObstacle(boss.position.x, boss.position.z, laserDirection, room),
          damage: boss.stats.attack,
          element,
          lifeMs: 520,
          maximumLifeMs: 520,
          piercing: false,
          isLightning: true,
          hasHit: false,
          skillTier: 2,
        };
        state.nextProjectileId += 1;
        state.lasers.push(laser);
        addLaserAfterimage(state, laser);
        return laser;
      });
  }
  return [-0.18, 0, 0.18].map((angle) => {
    const projectileDirection = {
      x: direction.x * Math.cos(angle) - direction.z * Math.sin(angle),
      z: direction.x * Math.sin(angle) + direction.z * Math.cos(angle),
    };
    return createProjectile(state, {
      owner: "enemy",
      sourceId: boss.id,
      roomId: session.currentRoomId,
      x: boss.position.x + projectileDirection.x * 0.75,
      y: BOSS_PROJECTILE_HEIGHT,
      z: boss.position.z + projectileDirection.z * 0.75,
      direction: projectileDirection,
      speed: ENEMY_PROJECTILE_SPEED * 1.2,
      damage: boss.stats.attack,
      element,
      particleSizeMultiplier: 1.65,
      particleCountScale: 0.42,
      skillTier: 2,
    });
  });
}

function createBossElectricWarnings(state, session, room, boss, lifeMs) {
  const direction = normalizedDirection(boss.position, session.player);
  const directions = [direction, { x: -direction.z, z: direction.x }, { x: -direction.x, z: -direction.z }, { x: direction.z, z: -direction.x }];
  for (const warningDirection of directions) {
    state.trajectoryWarnings.push({
      id: `electric-trajectory-${state.nextProjectileId}-${state.trajectoryWarnings.length}`,
      roomId: session.currentRoomId,
      x: boss.position.x,
      y: 0.03,
      z: boss.position.z,
      direction: warningDirection,
      length: distanceToMagicObstacle(boss.position.x, boss.position.z, warningDirection, room),
      width: 0.18,
      element: "electric",
      lifeMs,
      maximumLifeMs: lifeMs,
    });
  }
  return directions;
}

function createBossRadialPattern(state, session, room, boss, random, lifeMs) {
  const randomizedElements = Array.from({ length: 12 }, (_, index) => BOSS_RADIAL_ELEMENTS[index % 3])
    .map((element) => ({ element, order: random() }))
    .sort((left, right) => left.order - right.order)
    .map(({ element }) => element);
  return radialDirections(12).map((direction, index) => {
    const element = randomizedElements[index];
    const length = distanceToMagicObstacle(boss.position.x, boss.position.z, direction, room);
    state.trajectoryWarnings.push({
      id: `trajectory-${state.nextProjectileId}-${state.trajectoryWarnings.length}`,
      roomId: session.currentRoomId,
      x: boss.position.x,
      y: 0.028,
      z: boss.position.z,
      direction,
      length,
      width: 0.2,
      element,
      lifeMs,
      maximumLifeMs: lifeMs,
    });
    return { direction, element };
  });
}

function spawnBossRadialProjectiles(state, session, boss, pattern) {
  for (const element of new Set(pattern.map((projectile) => projectile.element))) {
    queueSoundEvent(state, {
      type: "magic-cast",
      owner: "enemy",
      element,
      x: boss.position.x,
      z: boss.position.z,
    });
  }
  return pattern.map(({ direction, element }) => createProjectile(state, {
    owner: "enemy",
    sourceId: boss.id,
    roomId: session.currentRoomId,
    x: boss.position.x + direction.x * 0.85,
    y: BOSS_PROJECTILE_HEIGHT,
    z: boss.position.z + direction.z * 0.85,
    direction,
    speed: ENEMY_PROJECTILE_SPEED * 1.08,
    damage: boss.stats.attack,
    element,
    particleSizeMultiplier: 1.35,
    skillTier: 3,
  }));
}

function scheduleBossDarkBarrage(state, session, boss) {
  for (let index = 0; index < 3; index += 1) {
    state.scheduledActions.push({
      type: "boss-target-area",
      delayMs: index * 850,
      roomId: session.currentRoomId,
      sourceId: boss.id,
      element: "dark",
      radius: 1,
      warningMs: 700,
      damage: boss.stats.attack,
      warningVisual: "dark-magic-circle",
    });
  }
  boss.bossPatternLockMs = 2600;
}

function scheduleBossLightningBarrage(state, session, boss) {
  for (let index = 0; index < 3; index += 1) {
    state.scheduledActions.push({
      type: "boss-lightning-target",
      delayMs: index * 900,
      roomId: session.currentRoomId,
      sourceId: boss.id,
      element: "electric",
      radius: 1,
      warningMs: 700,
      damage: boss.stats.attack * 1.05,
      warningVisual: "dark-magic-circle",
    });
  }
  boss.bossPatternLockMs = 2700;
}

function scheduleBossSummons(state, session, room, boss, random) {
  const summonTypes = ["warriorSpirit", "warriorSpirit", "mageSpirit"];
  const offsets = [
    { x: -2.6, z: -1.8 },
    { x: 2.6, z: -1.8 },
    { x: 0, z: 2.4 },
  ];
  const summons = [];
  for (let index = 0; index < summonTypes.length; index += 1) {
    const desired = {
      x: clamp(boss.position.x + offsets[index].x, -ROOM_HALF_SIZE + 1, ROOM_HALF_SIZE - 1),
      z: clamp(boss.position.z + offsets[index].z, -ROOM_HALF_SIZE + 1, ROOM_HALF_SIZE - 1),
    };
    if (isBlocked(room, desired.x, desired.z, 0.35)) {
      desired.x = clamp(boss.position.x + offsets[index].z, -ROOM_HALF_SIZE + 1, ROOM_HALF_SIZE - 1);
      desired.z = clamp(boss.position.z - offsets[index].x, -ROOM_HALF_SIZE + 1, ROOM_HALF_SIZE - 1);
    }
    summons.push({ templateId: summonTypes[index], position: desired });
    state.groundMagicCircles.push({
      id: `summon-circle-${state.nextSummonId}-${index}`,
      roomId: session.currentRoomId,
      x: desired.x,
      y: 0.025,
      z: desired.z,
      radius: 0.95,
      element: "dark",
      lifeMs: BOSS_SUMMON_WARNING_MS,
      maximumLifeMs: BOSS_SUMMON_WARNING_MS,
      type: "boss-summon",
    });
    addParticles(state, {
      x: desired.x,
      y: 0.12,
      z: desired.z,
      direction: { x: 0, z: 0 },
      element: "dark",
      particleSizeMultiplier: 1.35,
      particleLifetimeMultiplier: 1.4,
    }, 28, { burst: true, random });
  }
  queueSoundEvent(state, {
    type: "boss-summon",
    owner: "enemy",
    element: "dark",
    x: boss.position.x,
    z: boss.position.z,
  });
  state.scheduledActions.push({
    type: "boss-summon-complete",
    delayMs: BOSS_SUMMON_WARNING_MS,
    roomId: session.currentRoomId,
    sourceId: boss.id,
    summons,
  });
  boss.bossPatternLockMs = BOSS_SUMMON_WARNING_MS + 420;
  return summons;
}

function executeBossAction(state, session, room, monsters, boss, action, random) {
  if (!action) return null;
  if (action.type === "melee") return executeMeleeAttack(boss, session, state);
  if (action.type === "ranged") return spawnBossSecondSkill(state, session, room, boss, action.element, action.directions);
  if (action.type === "radial") {
    boss.bossPatternLockMs = 800;
    return spawnBossRadialProjectiles(state, session, boss, action.projectiles ?? []);
  }
  if (action.type === "dark-barrage") return scheduleBossDarkBarrage(state, session, boss);
  if (action.type === "lightning-barrage") return scheduleBossLightningBarrage(state, session, boss);
  if (action.type === "summon") return scheduleBossSummons(state, session, room, boss, random);
  return null;
}

function setMonsterState(monster, state, durationMs = 0, attackType = null) {
  monster.aiState = state;
  monster.stateTimeMs = durationMs;
  monster.pendingAttackType = attackType;
  monster.chargeProgress = state === MonsterState.ATTACK_PREPARING ? 0 : null;
}

function groundImmobilizedSlime(monster) {
  if (monster.movementStyle !== "hop") return;
  monster.slimeHopState = "waiting";
  monster.slimeHopTimerMs = SLIME_HOP_WAIT_MS;
  monster.slimeHopProgress = 0;
  monster.contactHitThisHop = false;
  monster.position.y = 0;
  setMonsterState(monster, MonsterState.IDLE);
}

function immobilizeMonster(monster, durationMs, element) {
  if (monster.isBoss) return;
  monster.immobilizedMs = Math.max(monster.immobilizedMs ?? 0, durationMs);
  monster.elementalStatus = { type: element, remainingMs: monster.immobilizedMs };
  groundImmobilizedSlime(monster);
}

function executeMeleeAttack(monster, session, combatState) {
  const dx = session.player.x - monster.position.x;
  const dz = session.player.z - monster.position.z;
  const distance = Math.hypot(dx, dz);
  const targetYaw = Math.atan2(dx, -dz);
  const insideArc = Math.abs(normalizeAngle(targetYaw - monster.attackYaw)) <= Math.PI * 0.28;
  queueSoundEvent(combatState, {
    type: monster.isBoss ? "boss-melee" : "melee",
    owner: "enemy",
    x: monster.position.x,
    z: monster.position.z,
  });
  const attackRange = getMeleeAttackRange(monster);
  if (distance <= attackRange && insideArc) {
    const damage = applyDamageToPlayer(session, monster.stats.attack, monster.element, combatState);
    combatState.lastEvent = {
      type: "enemy-melee-hit",
      sourceId: monster.id,
      damage,
      remainingHealth: session.player.health,
    };
  }
}

function recordMonsterFootsteps(monster, combatState, moved, elapsedMs) {
  if (monster.movementStyle === "hop") return;
  if (moved <= 0.0001) {
    monster.footstepTimerMs = 0;
    return;
  }
  monster.footstepTimerMs = (monster.footstepTimerMs ?? 0) + elapsedMs;
  while (monster.footstepTimerMs >= 400) {
    monster.footstepTimerMs -= 400;
    queueSoundEvent(combatState, {
      type: "footstep",
      owner: "enemy",
      x: monster.position.x,
      z: monster.position.z,
    });
  }
}

function applySlimeContactDamage(monster, session, combatState) {
  if (monster.contactHitThisHop) return;
  const distance = Math.hypot(
    session.player.x - monster.position.x,
    session.player.z - monster.position.z,
  );
  if (distance > getMonsterHitboxRadius(monster) + SLIME_CONTACT_RADIUS) return;
  monster.contactHitThisHop = true;
  const damage = applyDamageToPlayer(session, monster.stats.attack, monster.element, combatState);
  combatState.lastEvent = {
    type: "enemy-contact-hit",
    sourceId: monster.id,
    damage,
    remainingHealth: session.player.health,
  };
}

function updateSlimeBehavior(monster, { session, room, combatState, elapsedMs }) {
  monster.slimeHopState ??= "waiting";
  monster.slimeHopTimerMs ??= SLIME_HOP_WAIT_MS;
  monster.slimeLandingSquashMs = Math.max(0, (monster.slimeLandingSquashMs ?? 0) - elapsedMs);
  if (monster.slimeHopState === "waiting") {
    const awarenessDistance = Math.hypot(
      session.player.x - monster.position.x,
      session.player.z - monster.position.z,
    );
    if (!monster.hasDetectedPlayer && awarenessDistance > MONSTER_AWARENESS_RADIUS) {
      monster.slimeHopTimerMs = SLIME_HOP_WAIT_MS;
      monster.slimeHopProgress = 0;
      setMonsterState(monster, MonsterState.IDLE);
      return;
    }
    monster.hasDetectedPlayer = true;
    monster.slimeHopTimerMs -= elapsedMs;
    monster.slimeHopProgress = 0;
    setMonsterState(monster, MonsterState.IDLE);
    if (monster.slimeHopTimerMs <= 0) {
      monster.slimeHopState = "jumping";
      monster.slimeHopTimerMs = SLIME_HOP_DURATION_MS;
      monster.slimeHopProgress = 0;
      monster.contactHitThisHop = false;
      queueSoundEvent(combatState, {
        type: "slime-jump",
        owner: "enemy",
        playbackRate: monster.templateId === "bigSlime" ? 0.8 : 1,
        x: monster.position.x,
        z: monster.position.z,
      });
    }
    return;
  }

  const playerDirection = normalizedDirection(monster.position, session.player);
  const seconds = Math.min(elapsedMs, 100) / 1000;
  monster.slimeHopTimerMs -= elapsedMs;
  monster.slimeHopProgress = clamp(1 - monster.slimeHopTimerMs / SLIME_HOP_DURATION_MS, 0, 1);
  monster.attackYaw = Math.atan2(playerDirection.x, -playerDirection.z);
  const moved = navigateToward(
    monster.position,
    session.player,
    playerDirection,
    monster.stats.moveSpeed * MELEE_MOVE_SPEED_MULTIPLIER * 1.12 * seconds,
    room,
  );
  setMonsterState(monster, moved > 0.0001 ? MonsterState.WALKING : MonsterState.IDLE);
  applySlimeContactDamage(monster, session, combatState);
  if (monster.slimeHopTimerMs <= 0) {
    monster.slimeHopState = "waiting";
    monster.slimeHopTimerMs = SLIME_HOP_WAIT_MS;
    monster.slimeHopProgress = 0;
    monster.slimeLandingSquashMs = 180;
    queueSoundEvent(combatState, {
      type: "slime-land",
      owner: "enemy",
      playbackRate: monster.templateId === "bigSlime" ? 0.8 : 1,
      x: monster.position.x,
      z: monster.position.z,
    });
  }
}

function advanceMonsterAttack(monster, { session, combatState, elapsedMs }) {
  if (monster.aiState === MonsterState.ATTACK_PREPARING) {
    monster.stateTimeMs -= elapsedMs;
    monster.chargeProgress = clamp(1 - monster.stateTimeMs / ATTACK_PREPARE_MS, 0, 1);
    if (monster.stateTimeMs <= 0) {
      const attackType = monster.pendingAttackType;
      setMonsterState(monster, MonsterState.ATTACKING, 300, attackType);
      if (attackType === "ranged") {
        spawnEnemyMagic(combatState, session, monster);
        monster.rangedCooldownMs = RANGED_ATTACK_INTERVAL_MS;
      } else {
        executeMeleeAttack(monster, session, combatState);
        monster.attackCooldownMs = 1700;
      }
    }
    return true;
  }
  if (monster.aiState === MonsterState.ATTACKING) {
    monster.stateTimeMs -= elapsedMs;
    if (monster.stateTimeMs <= 0) setMonsterState(monster, MonsterState.IDLE);
    return true;
  }
  return false;
}

function updateBossBehavior(boss, { session, room, monsters, combatState, elapsedMs, random }) {
  boss.bossPauseCycleMs = (boss.bossPauseCycleMs ?? 15000) - elapsedMs;
  const phaseTwo = isBossPhaseTwo(boss);
  if (phaseTwo && !boss.phaseTwoSoundPlayed) {
    boss.phaseTwoSoundPlayed = true;
    queueSoundEvent(combatState, {
      type: "boss-phase-two",
      owner: "enemy",
      x: boss.position.x,
      z: boss.position.z,
    });
  }
  if ((boss.bossPausedMs ?? 0) > 0) {
    boss.bossPausedMs = Math.max(0, boss.bossPausedMs - elapsedMs);
    setMonsterState(boss, MonsterState.IDLE);
    return;
  }
  if (boss.bossPauseCycleMs <= 0) {
    boss.bossPauseCycleMs = 15000;
    boss.bossPausedMs = 3000;
    boss.bossActionPrepareMs = 0;
    boss.bossPendingAction = null;
    setMonsterState(boss, MonsterState.IDLE);
    combatState.lastEvent = { type: "boss-stagger", sourceId: boss.id, durationMs: 3000 };
    return;
  }

  if (phaseTwo) {
    boss.bossDarkCooldownMs = (boss.bossDarkCooldownMs ?? 10000) - elapsedMs;
    if (boss.bossDarkCooldownMs <= 0) {
      boss.bossDarkCooldownMs = 10000;
      queueSoundEvent(combatState, {
        type: "boss-dark-area",
        owner: "enemy",
        element: "dark",
        x: boss.position.x,
        z: boss.position.z,
      });
      createEnemyAreaAttack(combatState, session, boss, {
        element: "dark",
        x: boss.position.x,
        z: boss.position.z,
        radius: 5,
        warningMs: 2000,
        damage: boss.stats.attack * 1.15,
        warningVisual: "dark-magic-circle",
        releaseSoundType: "boss-dark-release",
      });
    }
  }

  if ((boss.bossPatternLockMs ?? 0) > 0) {
    boss.bossPatternLockMs = Math.max(0, boss.bossPatternLockMs - elapsedMs);
    setMonsterState(boss, MonsterState.ATTACKING, boss.bossPatternLockMs, boss.pendingAttackType);
    return;
  }

  boss.attackCooldownMs = (boss.attackCooldownMs ?? 0) - elapsedMs;
  if ((boss.bossActionPrepareMs ?? 0) > 0) {
    boss.bossActionPrepareMs -= elapsedMs;
    boss.chargeProgress = clamp(1 - boss.bossActionPrepareMs / (boss.bossActionPrepareDurationMs ?? ATTACK_PREPARE_MS), 0, 1);
    if (boss.bossActionPrepareMs <= 0) {
      const action = boss.bossPendingAction;
      setMonsterState(boss, MonsterState.ATTACKING, 320, action?.type ?? null);
      executeBossAction(combatState, session, room, monsters, boss, action, random);
      boss.bossPendingAction = null;
      boss.attackCooldownMs = 2000;
    }
    return;
  }
  if (boss.aiState === MonsterState.ATTACKING && boss.stateTimeMs > 0) {
    boss.stateTimeMs -= elapsedMs;
    if (boss.stateTimeMs <= 0) setMonsterState(boss, MonsterState.IDLE);
    return;
  }

  const distance = Math.hypot(session.player.x - boss.position.x, session.player.z - boss.position.z);
  const towardPlayer = normalizedDirection(boss.position, session.player);
  boss.attackYaw = Math.atan2(towardPlayer.x, -towardPlayer.z);
  if (boss.attackCooldownMs <= 0) {
    const rangedActions = [
      ...BOSS_SECOND_SKILL_ELEMENTS.map((element) => ({ type: "ranged", element })),
      { type: "dark-barrage" },
      { type: "lightning-barrage" },
      { type: "summon" },
      { type: "summon" },
      { type: "summon" },
      ...(phaseTwo ? [{ type: "radial" }] : []),
    ];
    const actions = distance <= BOSS_MELEE_RANGE
      ? [{ type: "melee" }, ...rangedActions]
      : rangedActions;
    const action = actions[Math.min(actions.length - 1, Math.floor(random() * actions.length))];
    boss.bossPendingAction = action;
    const prepareMs = action.type === "melee"
      ? BOSS_MELEE_PREPARE_MS
      : action.type === "radial" ? ATTACK_PREPARE_MS + 1000 : ATTACK_PREPARE_MS;
    if (action.type === "radial") {
      action.projectiles = createBossRadialPattern(combatState, session, room, boss, random, prepareMs);
    } else if (action.type === "ranged" && action.element === "electric") {
      action.directions = createBossElectricWarnings(combatState, session, room, boss, prepareMs);
    }
    boss.bossActionPrepareMs = prepareMs;
    boss.bossActionPrepareDurationMs = prepareMs;
    setMonsterState(boss, MonsterState.ATTACK_PREPARING, prepareMs, action.type);
    return;
  }

  let moved = 0;
  if (distance > 4.2) {
    moved = navigateToward(
      boss.position,
      session.player,
      towardPlayer,
      boss.stats.moveSpeed * Math.min(elapsedMs, 100) / 1000,
      room,
    );
  }
  setMonsterState(boss, moved > 0.0001 ? MonsterState.WALKING : MonsterState.IDLE);
  recordMonsterFootsteps(boss, combatState, moved, elapsedMs);
}

/** 모든 적은 정지·걷기·공격 준비·공격 시전 상태를 거치며 준비 시간은 1초다. */
export function updateMonsterBehavior(monster, { session, room, monsters = [], combatState, elapsedMs, random = Math.random }) {
  if ((monster.currentHealth ?? monster.stats.health) <= 0) return;
  if ((monster.immobilizedMs ?? 0) > 0) {
    groundImmobilizedSlime(monster);
    monster.immobilizedMs = Math.max(0, monster.immobilizedMs - elapsedMs);
    if (monster.elementalStatus) monster.elementalStatus.remainingMs = monster.immobilizedMs;
    if (monster.immobilizedMs <= 0) monster.elementalStatus = null;
    return;
  }
  if (monster.isBoss) {
    updateBossBehavior(monster, { session, room, monsters, combatState, elapsedMs, random });
    return;
  }
  if (monster.movementStyle === "hop") {
    updateSlimeBehavior(monster, { session, room, combatState, elapsedMs });
    return;
  }
  if (!monster.aiState) setMonsterState(monster, MonsterState.IDLE);
  if (advanceMonsterAttack(monster, { session, combatState, elapsedMs })) return;

  const player = session.player;
  const distance = Math.hypot(player.x - monster.position.x, player.z - monster.position.z);
  if (!monster.hasDetectedPlayer && distance > MONSTER_AWARENESS_RADIUS) {
    setMonsterState(monster, MonsterState.IDLE);
    recordMonsterFootsteps(monster, combatState, 0, elapsedMs);
    return;
  }
  monster.hasDetectedPlayer = true;
  const towardPlayer = normalizedDirection(monster.position, player);
  const seconds = Math.min(elapsedMs, 100) / 1000;
  const isRanged = monster.attackStyle === "ranged"
    || (monster.attackStyle === "hybrid" && distance > 2.1);
  monster.rangedCooldownMs = (monster.rangedCooldownMs ?? 0) - elapsedMs;
  monster.attackCooldownMs = (monster.attackCooldownMs ?? 0) - elapsedMs;

  if (isRanged) {
    const preferredDistance = clamp(monster.stats.attackRange * 0.72, 3, 4.6);
    let moved = 0;
    if (distance > preferredDistance + 0.55) {
      moved = navigateToward(monster.position, player, towardPlayer, monster.stats.moveSpeed * 0.34 * seconds, room);
    } else if (distance < preferredDistance - 0.55) {
      moved = moveAroundRocks(monster.position, { x: -towardPlayer.x, z: -towardPlayer.z }, monster.stats.moveSpeed * 0.38 * seconds, room);
    }
    setMonsterState(monster, moved > 0.0001 ? MonsterState.WALKING : MonsterState.IDLE);
    recordMonsterFootsteps(monster, combatState, moved, elapsedMs);
    if (monster.rangedCooldownMs <= 0 && distance <= monster.stats.attackRange + 1.2) {
      monster.attackYaw = Math.atan2(towardPlayer.x, -towardPlayer.z);
      setMonsterState(monster, MonsterState.ATTACK_PREPARING, ATTACK_PREPARE_MS, "ranged");
    }
    return;
  }

  const meleeAttackRange = getMeleeAttackRange(monster);
  if (distance <= meleeAttackRange && monster.attackCooldownMs <= 0) {
    monster.attackYaw = Math.atan2(towardPlayer.x, -towardPlayer.z);
    setMonsterState(monster, MonsterState.ATTACK_PREPARING, ATTACK_PREPARE_MS, "melee");
    return;
  }
  if (distance > Math.max(0.7, meleeAttackRange * 0.72)) {
    const moved = navigateToward(
      monster.position,
      player,
      towardPlayer,
      monster.stats.moveSpeed * MELEE_MOVE_SPEED_MULTIPLIER * 0.32 * seconds,
      room,
    );
    setMonsterState(monster, moved > 0.0001 ? MonsterState.WALKING : MonsterState.IDLE);
    recordMonsterFootsteps(monster, combatState, moved, elapsedMs);
  } else {
    setMonsterState(monster, MonsterState.IDLE);
    recordMonsterFootsteps(monster, combatState, 0, elapsedMs);
  }
}

function updateParticles(state, elapsedMs) {
  const seconds = elapsedMs / 1000;
  for (const particle of state.particles) {
    particle.lifeMs -= elapsedMs;
    particle.x += particle.velocityX * seconds;
    particle.y += particle.velocityY * seconds;
    particle.z += particle.velocityZ * seconds;
    particle.velocityY -= 0.24 * (particle.gravityScale ?? 1) * seconds;
    particle.rotation += particle.rotationSpeed * seconds;
  }
  state.particles = state.particles.filter((particle) => particle.lifeMs > 0);
}

function createGoldDrop(state, session, monster, random) {
  const amount = Math.floor(Math.min(0.999999, Math.max(0, random())) * 11);
  monster.goldRewardDropped = true;
  if (amount > 0) {
    state.goldDrops.push({
      id: `gold-${state.nextGoldDropId}`,
      roomId: session.currentRoomId,
      amount,
      x: monster.position.x,
      y: (monster.position.y ?? 0) + 0.18,
      z: monster.position.z,
      bobTimeMs: 0,
    });
    state.nextGoldDropId += 1;
  }
  return amount;
}

function createHeartDrop(state, session, monster, random) {
  monster.heartRewardChecked = true;
  if (Math.min(0.999999, Math.max(0, random())) >= 0.1) return false;
  state.heartDrops.push({
    id: `heart-${state.nextHeartDropId}`,
    roomId: session.currentRoomId,
    x: monster.position.x,
    y: (monster.position.y ?? 0) + 0.24,
    z: monster.position.z,
    bobTimeMs: 0,
  });
  state.nextHeartDropId += 1;
  return true;
}

function damageMonster(state, session, monster, requestedDamage, random, element = "normal", statusDurationMs = 0, options = {}) {
  const previousHealth = Math.max(0, monster.currentHealth ?? monster.stats.health);
  const matchupMultiplier = element === "ice" && monster.element === "water" ? 1.25 : 1;
  const ultimateMultiplier = !options.ignoreUltimateMultiplier && (session.player.ultimateBuffMs ?? 0) > 0 ? 1.5 : 1;
  const elementalDamage = Math.max(0, requestedDamage) * matchupMultiplier * ultimateMultiplier;
  const inflictedDamage = Math.min(previousHealth, Math.round(elementalDamage * 10) / 10);
  monster.currentHealth = previousHealth - inflictedDamage;
  monster.hitFlashMs = 220;
  monster.hasDetectedPlayer = true;
  monster.detectionAlertMs = 0;
  createDamageNumber(state, {
    roomId: session.currentRoomId,
    x: monster.position.x,
    y: monster.position.y ?? 0,
    z: monster.position.z,
    height: Math.max(0.8, monster.stats.size * 1.2),
  }, inflictedDamage, "player", random);
  if (monster.currentHealth > 0 && (element === "ice" || element === "electric")) {
    const durationMs = statusDurationMs || IMMOBILIZE_DURATION_MS;
    immobilizeMonster(monster, durationMs, element);
  }
  if (options.grantsUltimate !== false) addUltimateFromDamage(session.player, inflictedDamage);
  let goldDropped = null;
  let heartDropped = false;
  if (monster.currentHealth <= 0 && !monster.goldRewardDropped) {
    goldDropped = createGoldDrop(state, session, monster, random);
  }
  if (monster.currentHealth <= 0 && !monster.heartRewardChecked) {
    heartDropped = createHeartDrop(state, session, monster, random);
  }
  state.lastEvent = {
    type: "player-hit",
    monsterId: monster.id,
    damage: inflictedDamage,
    remainingHealth: monster.currentHealth,
    defeated: monster.currentHealth <= 0,
    goldDropped,
    heartDropped,
  };
  return inflictedDamage;
}

function updateGoldDrops(state, session, elapsedMs) {
  for (const drop of state.goldDrops) {
    drop.bobTimeMs += elapsedMs;
    if (drop.roomId !== session.currentRoomId) continue;
    if (Math.hypot(drop.x - session.player.x, drop.z - session.player.z) <= 0.7) {
      session.player.gold = (session.player.gold ?? 0) + drop.amount;
      drop.collected = true;
      state.lastEvent = {
        type: "gold-collected",
        amount: drop.amount,
        totalGold: session.player.gold,
      };
    }
  }
  state.goldDrops = state.goldDrops.filter((drop) => !drop.collected);
}

function updateHeartDrops(state, session, elapsedMs) {
  for (const drop of state.heartDrops) {
    drop.bobTimeMs += elapsedMs;
    if (drop.roomId !== session.currentRoomId) continue;
    if (Math.hypot(drop.x - session.player.x, drop.z - session.player.z) <= 0.7) {
      const maximumHealth = session.player.maximumHealth ?? 100;
      const previousHealth = session.player.health ?? maximumHealth;
      session.player.health = Math.min(maximumHealth, Math.round((previousHealth + maximumHealth / 3) * 10) / 10);
      drop.collected = true;
      state.lastEvent = {
        type: "heart-collected",
        healed: Math.round((session.player.health - previousHealth) * 10) / 10,
        currentHealth: session.player.health,
      };
    }
  }
  state.heartDrops = state.heartDrops.filter((drop) => !drop.collected);
}

function updateLasers(state, { monsters, session, room, elapsedMs, enemyTimeScale, random }) {
  for (const laser of state.lasers) {
    const laserElapsedMs = laser.owner === "enemy" ? elapsedMs * enemyTimeScale : elapsedMs;
    if (laser.owner === "enemy" && laserElapsedMs <= 0) continue;
    laser.lifeMs -= laserElapsedMs;
    if (laser.sustained && laser.owner === "player") {
      laser.direction = {
        x: Math.sin(session.player.cameraYaw),
        z: -Math.cos(session.player.cameraYaw),
      };
      laser.x = session.player.x;
      laser.y = 0.92;
      laser.z = session.player.z;
      laser.length = distanceToMagicObstacle(laser.x, laser.z, laser.direction, room);
      laser.afterimageTimerMs += laserElapsedMs;
      while (laser.afterimageTimerMs >= 160) {
        laser.afterimageTimerMs -= 160;
        addLaserAfterimage(state, laser, random);
      }
      const touchingIds = new Set();
      for (const monster of monsters) {
        if ((monster.currentHealth ?? monster.stats.health) <= 0) continue;
        const relativeX = monster.position.x - laser.x;
        const relativeZ = monster.position.z - laser.z;
        const along = relativeX * laser.direction.x + relativeZ * laser.direction.z;
        const perpendicular = Math.abs(relativeX * laser.direction.z - relativeZ * laser.direction.x);
        if (along < 0 || along > laser.length || perpendicular > laser.hitWidth + getMonsterHitboxRadius(monster)) continue;
        touchingIds.add(monster.id);
        let nextTickMs = (laser.tickTimers.get(monster.id) ?? laser.tickEveryMs) - laserElapsedMs;
        while (nextTickMs <= 0 && (monster.currentHealth ?? monster.stats.health) > 0) {
          damageMonster(state, session, monster, laser.damage, random, "light");
          nextTickMs += laser.tickEveryMs;
        }
        laser.tickTimers.set(monster.id, nextTickMs);
      }
      for (const targetId of laser.tickTimers.keys()) {
        if (!touchingIds.has(targetId)) laser.tickTimers.delete(targetId);
      }
      continue;
    }
    if (!laser.hasHit && laser.owner === "enemy") {
      const relativeX = session.player.x - laser.x;
      const relativeZ = session.player.z - laser.z;
      const along = relativeX * laser.direction.x + relativeZ * laser.direction.z;
      const perpendicular = Math.abs(relativeX * laser.direction.z - relativeZ * laser.direction.x);
      if (along >= 0 && along <= laser.length && perpendicular <= 0.58) {
        const damage = applyDamageToPlayer(session, laser.damage, laser.element, state);
        if (damage > 0) session.player.immobilizedMs = Math.max(session.player.immobilizedMs ?? 0, IMMOBILIZE_DURATION_MS);
        state.lastEvent = { type: "enemy-hit", sourceId: laser.sourceId, damage, remainingHealth: session.player.health };
      }
      laser.hasHit = true;
    } else if (!laser.hasHit) {
      const targets = monsters.map((monster) => {
        const relativeX = monster.position.x - laser.x;
        const relativeZ = monster.position.z - laser.z;
        const along = relativeX * laser.direction.x + relativeZ * laser.direction.z;
        const perpendicular = Math.abs(relativeX * laser.direction.z - relativeZ * laser.direction.x);
        return { monster, along, perpendicular };
      }).filter(({ monster, along, perpendicular }) => (
        (monster.currentHealth ?? monster.stats.health) > 0
        && along >= 0 && along <= laser.length
        && perpendicular <= getMonsterHitboxRadius(monster) + PLAYER_PROJECTILE_HIT_RADIUS * 0.7
      )).sort((left, right) => left.along - right.along);
      const hitTargets = laser.piercing ? targets : targets.slice(0, 1);
      for (const { monster: target } of hitTargets) {
        damageMonster(state, session, target, laser.damage, random, laser.element, laser.statusDurationMs);
        addParticles(state, {
          ...target.position,
          y: (target.position.y ?? 0) + 0.6,
          direction: laser.direction,
          element: laser.element,
        }, 42, { burst: true, random });
      }
      laser.hasHit = true;
    }
  }
  state.lasers = state.lasers.filter((laser) => laser.lifeMs > 0);
}

function updateProjectiles(state, { monsters, session, room, elapsedMs, enemyTimeScale, random }) {
  for (const projectile of state.projectiles) {
    const projectileElapsedMs = projectile.owner === "enemy" ? elapsedMs * enemyTimeScale : elapsedMs;
    if (projectile.owner === "enemy" && projectileElapsedMs <= 0) continue;
    const seconds = Math.min(projectileElapsedMs, 100) / 1000;
    const previousPosition = { x: projectile.x, z: projectile.z };
    projectile.lifeMs -= projectileElapsedMs;
    projectile.x += projectile.direction.x * projectile.speed * seconds;
    projectile.z += projectile.direction.z * projectile.speed * seconds;
    const trailCount = projectile.owner === "player"
      ? Math.max(5, Math.round(projectileElapsedMs / 9))
      : Math.max(3, Math.round(projectileElapsedMs / 14));
    addParticles(state, projectile, trailCount, { random });

    const rockCollision = findRockSegmentCollision(
      room,
      previousPosition,
      { x: projectile.x, z: projectile.z },
      0.08,
    );
    if (rockCollision) {
      projectile.x = rockCollision.x;
      projectile.z = rockCollision.z;
      projectile.lifeMs = 0;
      addParticles(state, projectile, 28, { burst: true, random });
      continue;
    }
    if (isBlocked(room, projectile.x, projectile.z, 0.08)) {
      projectile.lifeMs = 0;
      addParticles(state, projectile, 28, { burst: true, random });
      continue;
    }

    if (projectile.owner === "player") {
      const target = monsters.find((monster) => (
        (monster.currentHealth ?? monster.stats.health) > 0
        && Math.hypot(projectile.x - monster.position.x, projectile.z - monster.position.z) <= PLAYER_PROJECTILE_HIT_RADIUS * (projectile.hitRadiusScale ?? 1) + getMonsterHitboxRadius(monster)
      ));
      if (target) {
        damageMonster(state, session, target, projectile.damage, random, projectile.element, projectile.statusDurationMs);
        projectile.lifeMs = 0;
        addParticles(state, projectile, 48, { burst: true, random });
      }
    } else if (Math.hypot(projectile.x - session.player.x, projectile.z - session.player.z) <= 0.48) {
      const damage = applyDamageToPlayer(session, projectile.damage, projectile.element, state);
      projectile.lifeMs = 0;
      addParticles(state, projectile, 34, { burst: true, random });
      state.lastEvent = { type: "enemy-hit", sourceId: projectile.sourceId, damage, remainingHealth: session.player.health };
    }
  }
  state.projectiles = state.projectiles.filter((projectile) => projectile.lifeMs > 0);
}

function updateAreaAttacks(state, { monsters, session, room, elapsedMs, enemyTimeScale, random }) {
  for (const attack of state.areaAttacks) {
    const attackElapsedMs = attack.owner === "enemy" ? elapsedMs * enemyTimeScale : elapsedMs;
    if (attack.owner === "enemy" && attackElapsedMs <= 0) continue;
    if (!attack.triggered) {
      attack.warningMs -= attackElapsedMs;
      if (attack.warningMs <= 0) {
        attack.triggered = true;
        queueSoundEvent(state, {
          type: attack.releaseSoundType ?? (attack.type === "fire-meteor" ? "fire-meteor-impact" : "rock-impact"),
          owner: attack.owner,
          element: attack.element,
          x: attack.x,
          z: attack.z,
        });
        if (attack.type === "boss-target-lightning") {
          state.verticalLightnings.push({
            id: `boss-lightning-${state.nextProjectileId}`,
            roomId: attack.roomId,
            x: attack.x,
            y: 0.16,
            z: attack.z,
            topY: 6.4,
            element: "electric",
            lifeMs: 620,
            maximumLifeMs: 620,
            phase: random() * Math.PI * 2,
          });
          state.nextProjectileId += 1;
        }
        if (attack.type === "fire-meteor") {
          addParticles(state, {
            x: attack.x,
            y: 0.38,
            z: attack.z,
            direction: { x: 0, z: 0 },
            element: "normal",
            particleColor: "#777b80",
            particleShape: "circle",
            particleSizeMultiplier: 10,
            particleLifetimeMultiplier: 1.25,
            particleOpacity: 0.8,
          }, 110, { burst: true, random });
        }
        if (attack.type === "rock-room-quake") {
          addRockRoomEruptionParticles(state, attack.roomId, random);
        }
        if (attack.owner === "enemy" && attack.element === "dark") {
          state.blackFlames.push({
            id: `black-flame-${attack.id}`,
            roomId: attack.roomId,
            x: attack.x,
            y: 0.04,
            z: attack.z,
            radius: attack.radius,
            lifeMs: 1800,
            maximumLifeMs: 1800,
          });
          addParticles(state, {
            x: attack.x,
            y: 0.2,
            z: attack.z,
            direction: { x: 0, z: 0 },
            element: "dark",
            particleColor: "#160d20",
            particleSizeMultiplier: 2.2,
            particleLifetimeMultiplier: 1.6,
          }, Math.max(38, Math.round(attack.radius * 18)), { burst: true, random });
        }
        if (attack.owner === "enemy") {
          if (Math.hypot(session.player.x - attack.x, session.player.z - attack.z) <= attack.radius + 0.38) {
            const damage = applyDamageToPlayer(session, attack.damage, attack.element, state);
            if (damage > 0) session.player.immobilizedMs = Math.max(session.player.immobilizedMs ?? 0, attack.immobilizeMs ?? 0);
            state.lastEvent = { type: "enemy-area-hit", sourceId: attack.sourceId, damage, remainingHealth: session.player.health };
          }
        } else for (const monster of monsters) {
          if ((monster.currentHealth ?? monster.stats.health) <= 0) continue;
          if (Math.hypot(monster.position.x - attack.x, monster.position.z - attack.z) > attack.radius + getMonsterHitboxRadius(monster)) continue;
          damageMonster(state, session, monster, attack.damage, random, attack.element);
          if (attack.dotEffect && (monster.currentHealth ?? monster.stats.health) > 0) {
            addMonsterStatusEffect(state, session, monster, attack.dotEffect);
          }
          if (attack.immobilizeMs > 0 && (monster.currentHealth ?? monster.stats.health) > 0) {
            immobilizeMonster(monster, attack.immobilizeMs, "rock");
          }
          addParticles(state, {
            ...monster.position,
            y: (monster.position.y ?? 0) + 0.18,
            direction: { x: 0, z: 0 },
            element: attack.element,
            particleColor: "#4a8dff",
          }, 52, { burst: true, random });
        }
        if (attack.removesRocks && room?.rocks) {
          room.rocks = room.rocks.filter((rock) => Math.hypot(rock.x - attack.x, rock.z - attack.z) > attack.radius + 0.5);
        }
      }
      continue;
    }
    attack.quakeMs -= attackElapsedMs;
  }
  state.areaAttacks = state.areaAttacks.filter((attack) => !attack.triggered || attack.quakeMs > 0);
}

function updateScheduledActions(state, { monsters, session, room, elapsedMs, random }) {
  if (elapsedMs <= 0) return;
  for (const action of state.scheduledActions) {
    if (action.roomId !== session.currentRoomId) continue;
    action.delayMs -= elapsedMs;
    if (action.delayMs > 0) continue;
    const source = monsters.find((monster) => monster.id === action.sourceId);
    if (!source || (source.currentHealth ?? source.stats.health) <= 0) {
      action.completed = true;
      continue;
    }
    if (action.type === "boss-target-area" || action.type === "boss-lightning-target") {
      queueSoundEvent(state, {
        type: "magic-cast",
        owner: "enemy",
        element: action.element,
        x: source.position.x,
        z: source.position.z,
      });
      const attack = createEnemyAreaAttack(state, session, source, {
        element: action.element,
        x: session.player.x,
        z: session.player.z,
        radius: action.radius,
        warningMs: action.warningMs,
        damage: action.damage,
        immobilizeMs: 0,
        warningVisual: action.warningVisual,
      });
      if (action.type === "boss-lightning-target") attack.type = "boss-target-lightning";
    } else if (action.type === "boss-summon-complete") {
      const templates = getMonsterTemplates({ chapter: 1 });
      for (const summon of action.summons ?? []) {
        const template = templates.find((candidate) => candidate.templateId === summon.templateId);
        if (!template) continue;
        const monster = createMonsterInstance(template, {
          random,
          instanceIndex: state.nextSummonId,
          position: summon.position,
        });
        monster.id = `boss-summon-${state.nextSummonId}`;
        state.nextSummonId += 1;
        monsters.push(monster);
        addParticles(state, {
          x: summon.position.x,
          y: 0.45,
          z: summon.position.z,
          direction: { x: 0, z: 0 },
          element: "dark",
          particleSizeMultiplier: 1.7,
        }, 46, { burst: true, random });
      }
    }
    action.completed = true;
  }
  state.scheduledActions = state.scheduledActions.filter((action) => !action.completed);
}

function updateStatusEffects(state, { monsters, session, elapsedMs, random }) {
  for (const effect of state.statusEffects) {
    if (effect.roomId !== session.currentRoomId) continue;
    const monster = monsters.find((candidate) => candidate.id === effect.targetId);
    if (!monster || (monster.currentHealth ?? monster.stats.health) <= 0) {
      effect.completed = true;
      continue;
    }
    effect.remainingMs -= elapsedMs;
    effect.tickTimerMs -= elapsedMs;
    effect.particleTimerMs += elapsedMs;
    if (effect.immobilizes && !monster.isBoss) {
      monster.immobilizedMs = Math.max(monster.immobilizedMs ?? 0, effect.remainingMs);
      monster.elementalStatus = { type: effect.element, remainingMs: effect.remainingMs };
    }
    while (effect.tickTimerMs <= 0 && effect.remainingMs >= 0) {
      effect.tickTimerMs += effect.tickEveryMs;
      damageMonster(state, session, monster, effect.damage, random, effect.element);
    }
    if (effect.type === "burn" && effect.particleTimerMs >= 90) {
      effect.particleTimerMs %= 90;
      addParticles(state, {
        x: monster.position.x,
        y: (monster.position.y ?? 0) + monster.stats.size * 0.65,
        z: monster.position.z,
        direction: { x: 0, z: 0 },
        element: "fire",
        particleSizeMultiplier: 1.35,
        particleSpawnRadius: Math.max(0.5, monster.stats.size * 0.55),
        particleSpeedMultiplier: 0.72,
        particleUpwardSpeed: 0.34,
      }, 7, { burst: true, random });
    }
    if (effect.remainingMs <= 0) effect.completed = true;
  }
  state.statusEffects = state.statusEffects.filter((effect) => !effect.completed);
}

function updateWaves(state, { monsters, session, elapsedMs, random }) {
  const seconds = elapsedMs / 1000;
  for (const wave of state.waves) {
    if (wave.roomId !== session.currentRoomId) continue;
    wave.lifeMs -= elapsedMs;
    wave.x += wave.direction.x * wave.speed * seconds;
    wave.z += wave.direction.z * wave.speed * seconds;
    const side = { x: -wave.direction.z, z: wave.direction.x };
    for (const monster of monsters) {
      if ((monster.currentHealth ?? monster.stats.health) <= 0) continue;
      const relativeX = monster.position.x - wave.x;
      const relativeZ = monster.position.z - wave.z;
      const along = relativeX * wave.direction.x + relativeZ * wave.direction.z;
      const across = Math.abs(relativeX * side.x + relativeZ * side.z);
      const touchingWave = Math.abs(along) <= wave.thickness && across <= wave.width / 2;
      if (touchingWave && !wave.hitIds.has(monster.id)) {
        wave.hitIds.add(monster.id);
        if (!monster.isBoss) wave.carriedIds.add(monster.id);
        damageMonster(state, session, monster, wave.damage, random, "water");
      }
      if (!monster.isBoss && (touchingWave || wave.carriedIds.has(monster.id))) {
        monster.waterHitFlashMs = 320;
        const carrySpeed = wave.speed * 1.12;
        moveAroundRocks(monster.position, wave.direction, carrySpeed * seconds, { rocks: [] });
        monster.position.x = clamp(monster.position.x, -ROOM_HALF_SIZE + 0.45, ROOM_HALF_SIZE - 0.45);
        monster.position.z = clamp(monster.position.z, -ROOM_HALF_SIZE + 0.45, ROOM_HALF_SIZE - 0.45);
      }
    }
  }
  state.waves = state.waves.filter((wave) => wave.lifeMs > 0);
}

function updateBlackHoles(state, { monsters, session, elapsedMs, random }) {
  const seconds = elapsedMs / 1000;
  for (const blackHole of state.blackHoles) {
    if (blackHole.roomId !== session.currentRoomId) continue;
    blackHole.lifeMs -= elapsedMs;
    blackHole.particleTimerMs = (blackHole.particleTimerMs ?? 0) + elapsedMs;
    while (blackHole.particleTimerMs >= 55) {
      blackHole.particleTimerMs -= 55;
      for (let index = 0; index < 7; index += 1) {
        const angle = random() * Math.PI * 2;
        const radius = blackHole.coreRadius * (1.8 + random() * 2.1);
        const startY = blackHole.y + (random() - 0.5) * blackHole.coreRadius * 2.2;
        const travelSeconds = 0.55 + random() * 0.3;
        const lifeMs = travelSeconds * 1000;
        const startX = blackHole.x + Math.cos(angle) * radius;
        const startZ = blackHole.z + Math.sin(angle) * radius;
        state.particles.push({
          x: startX,
          y: startY,
          z: startZ,
          velocityX: (blackHole.x - startX) / travelSeconds,
          velocityY: (blackHole.y - startY) / travelSeconds,
          velocityZ: (blackHole.z - startZ) / travelSeconds,
          gravityScale: 0,
          size: (0.012 + random() * 0.018) * PARTICLE_SIZE_MULTIPLIER,
          rotation: random() * Math.PI * 2,
          rotationSpeed: (random() - 0.5) * 5,
          color: index % 3 === 0 ? "#170c20" : "#9158d8",
          glow: true,
          shape: "circle",
          blendMode: "source-over",
          lifeMs,
          maximumLifeMs: lifeMs,
        });
      }
    }
    for (const monster of monsters) {
      if ((monster.currentHealth ?? monster.stats.health) <= 0) continue;
      if (monster.isBoss) continue;
      const distance = Math.hypot(blackHole.x - monster.position.x, blackHole.z - monster.position.z);
      if (distance > blackHole.radius) continue;
      const direction = normalizedDirection(monster.position, blackHole);
      const pullSpeed = monster.isBoss ? 1.3 : 4.8;
      moveAroundRocks(monster.position, direction, Math.min(distance, pullSpeed * seconds), { rocks: [] });
      const previousTimer = blackHole.tickTimers.get(monster.id) ?? 500;
      const nextTimer = previousTimer - elapsedMs;
      if (distance <= blackHole.coreRadius && nextTimer <= 0) {
        damageMonster(state, session, monster, 15, random, "dark");
        blackHole.tickTimers.set(monster.id, nextTimer + 500);
      } else {
        blackHole.tickTimers.set(monster.id, nextTimer);
      }
    }
  }
  state.blackHoles = state.blackHoles.filter((blackHole) => blackHole.lifeMs > 0);
}

function updateDamageNumbers(state, elapsedMs) {
  for (const number of state.damageNumbers) {
    number.lifeMs -= elapsedMs;
    number.y += elapsedMs * 0.00065;
  }
  state.damageNumbers = state.damageNumbers.filter((number) => number.lifeMs > 0);
}

function updateUltimateFields(state, { monsters, session, elapsedMs, random }) {
  for (const field of state.ultimateFields) {
    if (field.roomId !== session.currentRoomId) continue;
    field.lifeMs -= elapsedMs;
    field.x = session.player.x;
    field.z = session.player.z;
    const touchingIds = new Set();
    for (const monster of monsters) {
      if ((monster.currentHealth ?? monster.stats.health) <= 0) continue;
      if (Math.hypot(monster.position.x - field.x, monster.position.z - field.z) > field.radius + getMonsterHitboxRadius(monster)) continue;
      touchingIds.add(monster.id);
      let nextTickMs = (field.tickTimers.get(monster.id) ?? field.tickEveryMs) - elapsedMs;
      while (nextTickMs <= 0 && (monster.currentHealth ?? monster.stats.health) > 0) {
        damageMonster(state, session, monster, field.damage, random, "light", 0, {
          ignoreUltimateMultiplier: true,
          grantsUltimate: false,
        });
        nextTickMs += field.tickEveryMs;
      }
      field.tickTimers.set(monster.id, nextTickMs);
    }
    for (const targetId of field.tickTimers.keys()) {
      if (!touchingIds.has(targetId)) field.tickTimers.delete(targetId);
    }
  }
  state.ultimateFields = state.ultimateFields.filter((field) => field.lifeMs > 0);
}

function updateDefenseBarrier(state, session, elapsedMs, random) {
  const barrier = session.player.defenseBarrier;
  if (!barrier) return;
  barrier.remainingMs = Math.max(0, barrier.remainingMs - elapsedMs);
  barrier.particleTimerMs = (barrier.particleTimerMs ?? 0) + elapsedMs;
  while (barrier.particleTimerMs >= 120 && barrier.remainingMs > 0) {
    barrier.particleTimerMs -= 120;
    addDefenseAuraParticles(state, session.player, barrier.element, 3, random);
  }
  if (barrier.remainingMs <= 0) session.player.defenseBarrier = null;
}

function updateCastEffects(state, session, elapsedMs) {
  for (const effect of state.castEffects) {
    effect.lifeMs -= elapsedMs;
    if (effect.tracksPlayer) {
      effect.x = session.player.x;
      effect.y = 0.92;
      effect.z = session.player.z;
      effect.direction = {
        x: Math.sin(session.player.cameraYaw),
        z: -Math.cos(session.player.cameraYaw),
      };
    }
  }
  state.castEffects = state.castEffects.filter((effect) => effect.lifeMs > 0);
}

function updateMeteors(state, elapsedMs, random) {
  for (const meteor of state.meteors) {
    meteor.lifeMs -= elapsedMs;
    const progress = clamp(1 - meteor.lifeMs / meteor.maximumLifeMs, 0, 1);
    const eased = progress * progress;
    meteor.x = meteor.startX + (meteor.targetX - meteor.startX) * eased;
    meteor.y = meteor.startY + (meteor.targetY - meteor.startY) * eased;
    meteor.z = meteor.startZ + (meteor.targetZ - meteor.startZ) * eased;
    meteor.particleTimerMs += elapsedMs;
    while (meteor.particleTimerMs >= 38 && meteor.lifeMs > 0) {
      meteor.particleTimerMs -= 38;
      addParticles(state, {
        x: meteor.x,
        y: meteor.y + 0.15,
        z: meteor.z,
        direction: { x: 0, z: 0 },
        element: "fire",
        particleShape: "square",
        particleSizeMultiplier: 1.8,
        particleLifetimeMultiplier: 0.7,
      }, 8, { random });
    }
  }
  state.meteors = state.meteors.filter((meteor) => meteor.lifeMs > 0);
}

function updateTransientMagicVisuals(state, elapsedMs, enemyTimeScale) {
  for (const lightning of state.verticalLightnings) lightning.lifeMs -= elapsedMs;
  state.verticalLightnings = state.verticalLightnings.filter((lightning) => lightning.lifeMs > 0);
  for (const circle of state.groundMagicCircles) circle.lifeMs -= elapsedMs * enemyTimeScale;
  state.groundMagicCircles = state.groundMagicCircles.filter((circle) => circle.lifeMs > 0);
  for (const warning of state.trajectoryWarnings) warning.lifeMs -= elapsedMs * enemyTimeScale;
  state.trajectoryWarnings = state.trajectoryWarnings.filter((warning) => warning.lifeMs > 0);
  for (const flame of state.blackFlames) flame.lifeMs -= elapsedMs * enemyTimeScale;
  state.blackFlames = state.blackFlames.filter((flame) => flame.lifeMs > 0);
}

export function updateCombatState(state, {
  monsters,
  session,
  room,
  elapsedMs,
  enemyTimeScale = 1,
  random = Math.random,
}) {
  const normalizedEnemyTimeScale = clamp(enemyTimeScale, 0, 1);
  state.roomEntryGraceMs = Math.max(0, (state.roomEntryGraceMs ?? 0) - elapsedMs);
  if (normalizedEnemyTimeScale > 0) {
    for (const monster of monsters) {
      if (!monster.isBoss && !monster.hasDetectedPlayer) {
        const distance = Math.hypot(
          session.player.x - monster.position.x,
          session.player.z - monster.position.z,
        );
        if (state.roomEntryGraceMs > 0 || distance > MONSTER_AWARENESS_RADIUS) {
          setMonsterState(monster, MonsterState.IDLE);
          continue;
        }
        monster.hasDetectedPlayer = true;
        monster.detectionAlertMs = MONSTER_DETECTION_ALERT_MS;
      }
      if (!monster.isBoss && (monster.detectionAlertMs ?? 0) > 0) {
        monster.detectionAlertMs = Math.max(0, monster.detectionAlertMs - elapsedMs * normalizedEnemyTimeScale);
        setMonsterState(monster, MonsterState.IDLE);
        continue;
      }
      updateMonsterBehavior(monster, {
        session,
        room,
        monsters,
        combatState: state,
        elapsedMs: elapsedMs * normalizedEnemyTimeScale,
        random,
      });
    }
  }
  updateScheduledActions(state, {
    monsters,
    session,
    room,
    elapsedMs: elapsedMs * normalizedEnemyTimeScale,
    random,
  });
  updateLasers(state, { monsters, session, room, elapsedMs, enemyTimeScale: normalizedEnemyTimeScale, random });
  updateProjectiles(state, {
    monsters,
    session,
    room,
    elapsedMs,
    enemyTimeScale: normalizedEnemyTimeScale,
    random,
  });
  updateAreaAttacks(state, { monsters, session, room, elapsedMs, enemyTimeScale: normalizedEnemyTimeScale, random });
  updateStatusEffects(state, { monsters, session, elapsedMs, random });
  updateWaves(state, { monsters, session, elapsedMs, random });
  updateBlackHoles(state, { monsters, session, elapsedMs, random });
  updateUltimateFields(state, { monsters, session, elapsedMs, random });
  updateMeteors(state, elapsedMs, random);
  updateDefenseBarrier(state, session, elapsedMs, random);
  updateParticles(state, elapsedMs);
  updateCastEffects(state, session, elapsedMs);
  updateTransientMagicVisuals(state, elapsedMs, normalizedEnemyTimeScale);
  updateGoldDrops(state, session, elapsedMs);
  updateHeartDrops(state, session, elapsedMs);
  updateDamageNumbers(state, elapsedMs);
  session.player.immobilizedMs = Math.max(0, (session.player.immobilizedMs ?? 0) - elapsedMs);
  session.player.hitFlashMs = Math.max(0, (session.player.hitFlashMs ?? 0) - elapsedMs);
  session.player.invulnerableMs = Math.max(0, (session.player.invulnerableMs ?? 0) - elapsedMs);
  session.player.ultimateBuffMs = Math.max(0, (session.player.ultimateBuffMs ?? 0) - elapsedMs);
  for (const monster of monsters) {
    monster.hitFlashMs = Math.max(0, (monster.hitFlashMs ?? 0) - elapsedMs);
    monster.waterHitFlashMs = Math.max(0, (monster.waterHitFlashMs ?? 0) - elapsedMs);
    monster.vineVisualMs = Math.max(0, (monster.vineVisualMs ?? 0) - elapsedMs);
  }
  return state;
}
