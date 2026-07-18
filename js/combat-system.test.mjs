import assert from "node:assert/strict";
import test from "node:test";
import { createSpiritKingBoss } from "./monster-catalog.js";
import {
  BOSS_ROCK_WARNING_DURATION_MS,
  BOSS_MELEE_PREPARE_MS,
  BOSS_MELEE_RANGE,
  ELEMENT_PRESENTATION,
  MELEE_MOVE_SPEED_MULTIPLIER,
  MonsterState,
  MONSTER_AWARENESS_RADIUS,
  MONSTER_DETECTION_ALERT_MS,
  MONSTER_ROOM_ENTRY_GRACE_MS,
  PLAYER_PROJECTILE_HIT_RADIUS,
  ROCK_AREA_RADIUS,
  SECOND_SKILL_ICE_IMMOBILIZE_DURATION_MS,
  SECOND_SKILL_ROCK_RADIUS,
  calculateIncomingPlayerDamage,
  calculateRuneDamage,
  createCombatState,
  drainCombatSoundEvents,
  getElementDisplayName,
  getEnemyTimeScaleForInputMode,
  getMeleeAttackRange,
  isBossPhaseTwo,
  spawnPlayerDefense,
  spawnPlayerMagic,
  spawnPlayerUltimate,
  updateCombatState,
  updateMonsterBehavior,
} from "./combat-system.js";

function createSession() {
  return {
    currentRoomId: "room-1",
    player: {
      x: 0,
      z: 0,
      cameraYaw: 0,
      health: 100,
      maximumHealth: 100,
      ultimate: 0,
      maximumUltimate: 100,
      gold: 0,
    },
  };
}

function createMonster(overrides = {}) {
  return {
    id: "slime-0",
    name: "슬라임",
    element: "fire",
    attackStyle: "melee",
    position: { x: 0, y: 0, z: -3 },
    stats: { health: 150, attack: 12, size: 1, attackRange: 1.1, moveSpeed: 1.8 },
    currentHealth: 150,
    maximumHealth: 150,
    rangedCooldownMs: 0,
    attackCooldownMs: 0,
    aiState: MonsterState.IDLE,
    stateTimeMs: 0,
    ...overrides,
  };
}

test("정확도 피해는 100점에 100이고 1%마다 0.5 감소하며 30% 이하는 실패한다", () => {
  assert.equal(calculateRuneDamage(100), 100);
  assert.equal(calculateRuneDamage(99), 99.5);
  assert.equal(calculateRuneDamage(31), 65.5);
  assert.equal(calculateRuneDamage(30), 0);
  assert.equal(calculateRuneDamage(100, 150), 150);
});

test("2스킬은 발사체 3개 또는 4방향 광선을 만들고 최대 피해가 150이다", () => {
  const projectileState = createCombatState();
  const projectileSession = createSession();
  const projectiles = spawnPlayerMagic(projectileState, projectileSession, "fire", {
    damage: calculateRuneDamage(100, 150),
    skillTier: 2,
  });
  assert.equal(projectiles.length, 3);
  assert.equal(projectileState.projectiles.length, 3);
  assert.ok(projectiles.every((projectile) => projectile.damage === 150 && projectile.particleSizeMultiplier > 1));

  const laserState = createCombatState();
  const lasers = spawnPlayerMagic(laserState, createSession(), "electric", { damage: 150, skillTier: 2, room: { rocks: [] } });
  assert.equal(lasers.length, 4);
  assert.equal(laserState.lasers.length, 4);
});

test("바위 2스킬은 반지름 5 범위를 타격해 2초 속박하고 범위 안 돌을 없앤다", () => {
  const state = createCombatState();
  const session = createSession();
  const monster = createMonster({ position: { x: 0, y: 0, z: -4.2 }, attackCooldownMs: 9999 });
  const room = { rocks: [{ x: 0, z: -4 }, { x: 6, z: 6 }] };
  const area = spawnPlayerMagic(state, session, "rock", { damage: 80, skillTier: 2, room });
  assert.equal(area.radius, SECOND_SKILL_ROCK_RADIUS);
  assert.equal(area.radius, 5);
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 1000, random: () => 0.5 });
  assert.equal(monster.currentHealth, 70);
  assert.equal(monster.immobilizedMs, 2000);
  assert.deepEqual(room.rocks, [{ x: 6, z: 6 }]);
});

test("플레이어 속성 투사체는 계산된 피해를 적에게 준다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const monster = createMonster({ position: { x: 0, y: 0, z: -2 } });
  spawnPlayerMagic(state, session, "fire", { damage: 80 });
  for (let index = 0; index < 3; index += 1) {
    updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 100, random: () => 0.5 });
  }
  assert.equal(monster.currentHealth, 70);
  assert.equal(state.lastEvent?.damage, 80);
});

test("빛 속성은 투사체 대신 레이저와 잔상 파티클을 만든다", () => {
  const state = createCombatState();
  const session = createSession();
  const monster = createMonster({ position: { x: 0, y: 0, z: -3 } });
  const magic = spawnPlayerMagic(state, session, "light", { damage: 90 });
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.lasers.length, 1);
  assert.equal(magic.element, "light");
  assert.ok(state.particles.length >= 8 && state.particles.length <= 40);
  assert.ok(state.particles.every((particle) => particle.shape === "four-point-star"));
  assert.ok(state.particles.every((particle) => particle.maximumLifeMs >= 1620));
  updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 16, random: () => 0.5 });
  assert.equal(monster.currentHealth, 60);
});

test("마법은 플레이어 위치에서 카메라 방향으로 발사되고 피격 반지름이 넓다", () => {
  const state = createCombatState();
  const session = createSession();
  session.player.cameraYaw = Math.PI / 2;
  const projectile = spawnPlayerMagic(state, session, "fire", { damage: 10 });
  assert.equal(projectile.x, session.player.x);
  assert.equal(projectile.z, session.player.z);
  assert.ok(Math.abs(projectile.direction.x - 1) < 0.000001);
  assert.ok(Math.abs(projectile.direction.z) < 0.000001);
  assert.ok(PLAYER_PROJECTILE_HIT_RADIUS >= 0.5);
});

test("빛 레이저는 경로 안의 여러 적을 모두 관통한다", () => {
  const state = createCombatState();
  const session = createSession();
  const nearMonster = createMonster({ id: "near", position: { x: 0, y: 0, z: -2 }, attackCooldownMs: 9999 });
  const farMonster = createMonster({ id: "far", position: { x: 0, y: 0, z: -4 }, attackCooldownMs: 9999 });
  spawnPlayerMagic(state, session, "light", { damage: 40 });
  updateCombatState(state, {
    monsters: [nearMonster, farMonster],
    session,
    room: { rocks: [] },
    elapsedMs: 16,
    random: () => 0.5,
  });
  assert.equal(nearMonster.currentHealth, 110);
  assert.equal(farMonster.currentHealth, 110);
});

test("얼음과 전기 공격은 적을 2초간 움직이지 못하게 하고 전기는 번개 광선이다", () => {
  const iceState = createCombatState();
  const iceSession = createSession();
  const iceTarget = createMonster({ position: { x: 0, y: 0, z: -1 } });
  spawnPlayerMagic(iceState, iceSession, "ice", { damage: 20 });
  updateCombatState(iceState, {
    monsters: [iceTarget],
    session: iceSession,
    room: { rocks: [] },
    elapsedMs: 100,
    random: () => 0.5,
  });
  assert.equal(iceTarget.immobilizedMs, 2000);
  assert.equal(iceTarget.elementalStatus.type, "ice");

  const electricState = createCombatState();
  const electricSession = createSession();
  const electricTarget = createMonster({ position: { x: 0, y: 0, z: -3 } });
  const lightning = spawnPlayerMagic(electricState, electricSession, "electric", { damage: 20 });
  assert.equal(lightning.isLightning, true);
  assert.ok(electricState.particles.length >= 8 && electricState.particles.length <= 40);
  updateCombatState(electricState, {
    monsters: [electricTarget],
    session: electricSession,
    room: { rocks: [] },
    elapsedMs: 16,
    random: () => 0.5,
  });
  assert.equal(electricTarget.immobilizedMs, 2000);
  assert.equal(electricTarget.elementalStatus.type, "electric");
});

test("얼음 2스킬은 적을 3초간 속박한다", () => {
  const state = createCombatState();
  const session = createSession();
  const target = createMonster({ position: { x: 0, y: 0, z: -1 } });
  spawnPlayerMagic(state, session, "ice", { damage: 20, skillTier: 2 });
  updateCombatState(state, {
    monsters: [target],
    session,
    room: { rocks: [] },
    elapsedMs: 100,
    random: () => 0.5,
  });
  assert.equal(target.immobilizedMs, SECOND_SKILL_ICE_IMMOBILIZE_DURATION_MS);
});

test("방어 마법은 공격 없이 3초 보호막을 만들고 기본 30%와 속성 추가 반감을 적용한다", () => {
  const state = createCombatState();
  const session = createSession();
  spawnPlayerDefense(state, session, "fire");
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.lasers.length, 0);
  assert.equal(state.areaAttacks.length, 0);
  assert.equal(session.player.defenseBarrier.remainingMs, 3000);
  assert.ok(state.particles.length >= 26);
  assert.equal(calculateIncomingPlayerDamage(session.player, 100, "normal"), 70);
  assert.equal(calculateIncomingPlayerDamage(session.player, 100, "grass"), 35);
  updateCombatState(state, { monsters: [], session, room: { rocks: [] }, elapsedMs: 2999 });
  assert.ok(session.player.defenseBarrier);
  updateCombatState(state, { monsters: [], session, room: { rocks: [] }, elapsedMs: 1 });
  assert.equal(session.player.defenseBarrier, null);
});

test("바위 1스킬은 4.2칸 앞의 반지름 2.5 범위를 1초 경고한 뒤 한 번 타격한다", () => {
  const state = createCombatState();
  const session = createSession();
  const monster = createMonster({
    position: { x: 0, y: 0, z: -4.2 },
    attackCooldownMs: 9999,
    stats: { health: 150, attack: 12, size: 1, attackRange: 1.1, moveSpeed: 0 },
  });
  const area = spawnPlayerMagic(state, session, "rock", { damage: 55 });
  assert.equal(state.projectiles.length, 0);
  assert.equal(area.radius, ROCK_AREA_RADIUS);
  assert.equal(area.radius, 2.5);
  assert.equal(area.z, -4.2);
  updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 999, random: () => 0.5 });
  assert.equal(monster.currentHealth, 150);
  updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 1, random: () => 0.5 });
  assert.equal(monster.currentHealth, 95);
  assert.equal(drainCombatSoundEvents(state)[0].type, "rock-impact");
});

test("빠른 투사체와 빛 레이저는 돌을 통과해 뒤의 적을 맞히지 못한다", () => {
  const projectileState = createCombatState();
  const projectileSession = createSession();
  const projectileTarget = createMonster({ position: { x: 0, y: 0, z: -2.5 }, attackCooldownMs: 9999 });
  const room = { rocks: [{ x: 0, z: -1 }] };
  spawnPlayerMagic(projectileState, projectileSession, "fire", { damage: 50, room });
  updateCombatState(projectileState, {
    monsters: [projectileTarget],
    session: projectileSession,
    room,
    elapsedMs: 100,
    random: () => 0.5,
  });
  assert.equal(projectileTarget.currentHealth, 150);
  assert.equal(projectileState.projectiles.length, 0);

  const laserState = createCombatState();
  const laserSession = createSession();
  const laserTarget = createMonster({ position: { x: 0, y: 0, z: -4 }, attackCooldownMs: 9999 });
  const laser = spawnPlayerMagic(laserState, laserSession, "light", { damage: 50, room: { rocks: [{ x: 0, z: -2 }] } });
  assert.ok(laser.length < 2);
  updateCombatState(laserState, {
    monsters: [laserTarget],
    session: laserSession,
    room: { rocks: [{ x: 0, z: -2 }] },
    elapsedMs: 16,
    random: () => 0.5,
  });
  assert.equal(laserTarget.currentHealth, 150);
});

test("속성별 입자 모양과 빛 합성 방식을 보관한다", () => {
  assert.equal(ELEMENT_PRESENTATION.fire.shape, "square");
  assert.equal(ELEMENT_PRESENTATION.rock.shape, "square");
  assert.equal(ELEMENT_PRESENTATION.ice.shape, "triangle");
  assert.equal(ELEMENT_PRESENTATION.grass.shape, "leaf");
  assert.equal(ELEMENT_PRESENTATION.light.blendMode, "lighter");
  assert.equal(ELEMENT_PRESENTATION.dark.blendMode, "multiply");
  assert.equal(ELEMENT_PRESENTATION.fire.color, "#ff8a24");
});

test("마법 파티클과 마법진은 이전보다 크고 오래 유지된다", () => {
  const state = createCombatState();
  const session = createSession();
  spawnPlayerMagic(state, session, "fire", { damage: 10 });
  assert.ok(state.particles.every((particle) => particle.maximumLifeMs >= 648));
  assert.ok(state.particles.every((particle) => particle.size >= 0.0128));
  assert.equal(state.castEffects[0].maximumLifeMs, 1800);
});

test("근거리 적은 걷기 상태로 플레이어를 향해 느리게 이동한다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const monster = createMonster({ position: { x: 0, y: 0, z: -5 } });
  const before = Math.hypot(monster.position.x, monster.position.z);
  updateMonsterBehavior(monster, { session, room, combatState: state, elapsedMs: 1000 });
  const after = Math.hypot(monster.position.x, monster.position.z);
  assert.ok(after < before);
  assert.ok(before - after < monster.stats.moveSpeed);
  assert.equal(monster.aiState, MonsterState.WALKING);
  assert.equal(MELEE_MOVE_SPEED_MULTIPLIER, 1.5);
});

test("근접 몬스터는 직선의 돌을 피해 격자 경로로 플레이어에게 접근한다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [{ x: 0, z: -2 }] };
  const monster = createMonster({ position: { x: 0, y: 0, z: -3.2 }, attackCooldownMs: 9999 });
  for (let index = 0; index < 12; index += 1) {
    updateMonsterBehavior(monster, { session, room, combatState: state, elapsedMs: 100 });
  }
  assert.ok(Math.abs(monster.position.x) > 0.2);
  assert.ok(monster.position.z > -3.2);
});

test("슬라임은 0.3초 대기 후 크게 점프하며 근접공격 대신 접촉 피해를 준다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const slime = createMonster({
    templateId: "slime",
    movementStyle: "hop",
    slimeHopState: "waiting",
    slimeHopTimerMs: 300,
    position: { x: 0, y: 0, z: -0.75 },
  });
  updateMonsterBehavior(slime, { session, room, combatState: state, elapsedMs: 299 });
  assert.equal(slime.slimeHopState, "waiting");
  assert.equal(slime.position.z, -0.75);
  updateMonsterBehavior(slime, { session, room, combatState: state, elapsedMs: 1 });
  assert.equal(slime.slimeHopState, "jumping");
  assert.equal(drainCombatSoundEvents(state)[0].type, "slime-jump");
  updateMonsterBehavior(slime, { session, room, combatState: state, elapsedMs: 100 });
  assert.ok(slime.slimeHopProgress > 0);
  assert.equal(session.player.health, 88);
  assert.notEqual(slime.aiState, MonsterState.ATTACK_PREPARING);
  updateMonsterBehavior(slime, { session, room, combatState: state, elapsedMs: 420 });
  const landing = drainCombatSoundEvents(state).find((event) => event.type === "slime-land");
  assert.ok(landing);
});

test("빅슬라임의 점프 효과음은 0.8배 피치로 요청된다", () => {
  const state = createCombatState();
  const session = createSession();
  const bigSlime = createMonster({
    templateId: "bigSlime",
    movementStyle: "hop",
    slimeHopState: "waiting",
    slimeHopTimerMs: 1,
  });
  updateMonsterBehavior(bigSlime, {
    session,
    room: { rocks: [] },
    combatState: state,
    elapsedMs: 1,
  });
  assert.equal(drainCombatSoundEvents(state)[0].playbackRate, 0.8);
});

test("원거리 적은 1초 동안 기를 모은 뒤 2배 빨라진 마법을 발사한다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const monster = createMonster({
    attackStyle: "ranged",
    hasDetectedPlayer: true,
    position: { x: 0, y: 0, z: -4 },
    stats: { health: 72, attack: 15, size: 1, attackRange: 5.4, moveSpeed: 1.25 },
  });
  updateMonsterBehavior(monster, { session, room, combatState: state, elapsedMs: 100 });
  assert.equal(monster.aiState, MonsterState.ATTACK_PREPARING);
  assert.equal(state.projectiles.length, 0);
  updateMonsterBehavior(monster, { session, room, combatState: state, elapsedMs: 999 });
  assert.equal(state.projectiles.length, 0);
  updateMonsterBehavior(monster, { session, room, combatState: state, elapsedMs: 1 });
  assert.equal(monster.aiState, MonsterState.ATTACKING);
  assert.equal(state.projectiles[0].speed, 2.9);
  assert.deepEqual(
    drainCombatSoundEvents(state).map((event) => [event.type, event.element]),
    [["magic-cast", monster.element]],
  );
});

test("근접 적은 1초 준비 후 부채꼴 안의 플레이어만 공격한다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const monster = createMonster({ position: { x: 0, y: 0, z: -0.9 } });
  updateMonsterBehavior(monster, { session, room, combatState: state, elapsedMs: 16 });
  assert.equal(monster.aiState, MonsterState.ATTACK_PREPARING);
  assert.equal(monster.pendingAttackType, "melee");
  assert.equal(session.player.health, 100);
  updateMonsterBehavior(monster, { session, room, combatState: state, elapsedMs: 1000 });
  assert.equal(monster.aiState, MonsterState.ATTACKING);
  assert.equal(session.player.health, 88);
  assert.equal(drainCombatSoundEvents(state)[0].type, "melee");
});

test("룬 모드의 적 이동·공격 준비·적 투사체는 모두 0.5배속으로 진행된다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const monster = createMonster({
    attackStyle: "ranged",
    hasDetectedPlayer: true,
    position: { x: 0, y: 0, z: -4 },
    stats: { health: 72, attack: 15, size: 1, attackRange: 5.4, moveSpeed: 1.25 },
  });
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 100, enemyTimeScale: 0.5 });
  assert.equal(monster.aiState, MonsterState.ATTACK_PREPARING);
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 1000, enemyTimeScale: 0.5 });
  assert.equal(monster.stateTimeMs, 500);
  assert.equal(state.projectiles.length, 0);
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 1000, enemyTimeScale: 0.5 });
  assert.equal(state.projectiles.length, 1);
  const startZ = state.projectiles[0].z;
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 100, enemyTimeScale: 0.5 });
  assert.ok(Math.abs(state.projectiles[0].z - startZ) < state.projectiles[0].speed * 0.1);
});

test("일반 룬 중 일반 적은 멈추고 보스는 0.25배속이며 궁극기 입력 중에는 모두 멈춘다", () => {
  assert.equal(getEnemyTimeScaleForInputMode("drawing"), 0);
  assert.equal(getEnemyTimeScaleForInputMode("drawing", { isBoss: true }), 0.25);
  assert.equal(getEnemyTimeScaleForInputMode("drawing", { isBoss: true, isUltimate: true }), 0);
  assert.equal(getEnemyTimeScaleForInputMode("rune-ready", { isBoss: true, isUltimate: true }), 0);
  assert.equal(getEnemyTimeScaleForInputMode("rune-ready"), 0.5);
  assert.equal(getEnemyTimeScaleForInputMode("exploring"), 1);
});

test("시작된 적 근접공격은 플레이어가 범위를 벗어나도 취소되지 않는다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const monster = createMonster({ position: { x: 0, y: 0, z: -0.9 } });
  updateMonsterBehavior(monster, { session, room, combatState: state, elapsedMs: 16 });
  session.player.z = 5;
  updateMonsterBehavior(monster, { session, room, combatState: state, elapsedMs: 1000 });
  assert.equal(monster.aiState, MonsterState.ATTACKING);
  assert.equal(monster.pendingAttackType, "melee");
});

test("근접 공격 판정 범위는 몬스터 기본 범위보다 35% 넓다", () => {
  const monster = createMonster();
  assert.equal(getMeleeAttackRange(monster), monster.stats.attackRange * 1.35);
  assert.equal(getMeleeAttackRange(createSpiritKingBoss()), BOSS_MELEE_RANGE);
});

test("정령왕은 15초 주기마다 3초간 멈춘다", () => {
  const state = createCombatState();
  const session = createSession();
  const boss = createSpiritKingBoss({ position: { x: 0, z: -15 } });
  boss.bossPauseCycleMs = 10;
  updateMonsterBehavior(boss, { session, room: { rocks: [] }, combatState: state, elapsedMs: 10, random: () => 0 });
  assert.equal(boss.bossPausedMs, 3000);
  assert.equal(boss.aiState, MonsterState.IDLE);
});

test("체력 1500 이하 정령왕은 자기 중심 지름 10 어둠 범위 공격을 2초 준비한다", () => {
  const state = createCombatState();
  const session = createSession();
  const boss = createSpiritKingBoss({ position: { x: 0, z: -5 } });
  boss.currentHealth = 1500;
  boss.bossPauseCycleMs = 99999;
  boss.bossDarkCooldownMs = 10;
  boss.attackCooldownMs = 99999;
  const castCenter = { x: boss.position.x, z: boss.position.z };
  updateMonsterBehavior(boss, { session, room: { rocks: [] }, combatState: state, elapsedMs: 10, random: () => 0 });
  const attack = state.areaAttacks[0];
  assert.equal(attack.element, "dark");
  assert.equal(attack.radius * 2, 10);
  assert.equal(attack.warningMs, 2000);
  assert.deepEqual({ x: attack.x, z: attack.z }, castCenter);
  const phaseSounds = drainCombatSoundEvents(state);
  assert.ok(phaseSounds.some((event) => event.type === "boss-phase-two"));
  assert.ok(phaseSounds.some((event) => event.type === "boss-dark-area"));
  updateCombatState(state, { monsters: [boss], session, room: { rocks: [] }, elapsedMs: 1999, random: () => 0.5 });
  updateCombatState(state, { monsters: [boss], session, room: { rocks: [] }, elapsedMs: 1, random: () => 0.5 });
  assert.equal(state.blackFlames.length, 1);
  assert.deepEqual({ x: state.blackFlames[0].x, z: state.blackFlames[0].z }, castCenter);
  assert.ok(drainCombatSoundEvents(state).some((event) => event.type === "boss-dark-release"));
});

test("적에게 실제로 입힌 피해의 30분의 1만큼 궁극기가 차고 처치 시 0~10G가 드롭된다", () => {
  const state = createCombatState();
  const session = createSession();
  const monster = createMonster({
    position: { x: 0, y: 0, z: -2 },
    currentHealth: 50,
    maximumHealth: 50,
  });
  spawnPlayerMagic(state, session, "fire", { damage: 80 });
  for (let index = 0; index < 3; index += 1) {
    updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 100, random: () => 0.99 });
  }
  assert.equal(monster.currentHealth, 0);
  assert.ok(Math.abs(session.player.ultimate - 5 / 3) < 0.000001);
  assert.equal(state.goldDrops[0].amount, 10);
  session.player.z = -2;
  updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 16, random: () => 0.99 });
  assert.equal(session.player.gold, 10);
  assert.equal(state.goldDrops.length, 0);
});

test("적 이름에 사용할 한글 속성 이름을 제공한다", () => {
  assert.equal(getElementDisplayName("electric"), "전기");
  assert.equal(getElementDisplayName("grass"), "풀");
});

test("보스를 제외한 적은 플레이어가 7칸 안에 들어와야 움직인다", () => {
  const state = createCombatState();
  const session = createSession();
  const monster = createMonster({ position: { x: 0, y: 0, z: -7.1 }, attackCooldownMs: 9999 });
  updateMonsterBehavior(monster, { session, room: { rocks: [] }, combatState: state, elapsedMs: 1000 });
  assert.equal(MONSTER_AWARENESS_RADIUS, 7);
  assert.equal(monster.position.z, -7.1);
  assert.equal(monster.aiState, MonsterState.IDLE);
  monster.position.z = -6.9;
  updateMonsterBehavior(monster, { session, room: { rocks: [] }, combatState: state, elapsedMs: 100 });
  assert.ok(monster.position.z > -6.9);
});

test("방 입장 1초 뒤 느낌표를 띄운 적은 이후 7칸 밖에서도 계속 추격한다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const monster = createMonster({ position: { x: 0, y: 0, z: -6.5 }, attackCooldownMs: 9999 });
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 999, random: () => 0.5 });
  assert.equal(MONSTER_ROOM_ENTRY_GRACE_MS, 1000);
  assert.equal(monster.hasDetectedPlayer, undefined);
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 1, random: () => 0.5 });
  assert.equal(monster.hasDetectedPlayer, true);
  assert.equal(monster.detectionAlertMs, MONSTER_DETECTION_ALERT_MS - 1);
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: MONSTER_DETECTION_ALERT_MS, random: () => 0.5 });
  const beforeNearChase = monster.position.z;
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 100, random: () => 0.5 });
  assert.ok(monster.position.z > beforeNearChase);
  monster.position.z = -7.05;
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 100, random: () => 0.5 });
  assert.ok(monster.position.z > -7.05);
});

test("거리에 상관없이 공격받은 적은 경고 대기 없이 즉시 플레이어를 추격한다", () => {
  const state = createCombatState();
  state.roomEntryGraceMs = 9999;
  const session = createSession();
  const room = { rocks: [] };
  const monster = createMonster({ position: { x: 0, y: 0, z: -7.05 }, attackCooldownMs: 9999 });
  spawnPlayerMagic(state, session, "light", { damage: 10, room });
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 16, random: () => 0.5 });
  assert.equal(monster.hasDetectedPlayer, true);
  assert.equal(monster.detectionAlertMs, 0);
  const beforeChase = monster.position.z;
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 100, random: () => 0.5 });
  assert.ok(monster.position.z > beforeChase);
});

test("얼음 공격은 물 속성 적에게 1.25배 피해를 준다", () => {
  const state = createCombatState();
  const session = createSession();
  const monster = createMonster({ element: "water", position: { x: 0, y: 0, z: -2 }, currentHealth: 100, maximumHealth: 100 });
  spawnPlayerMagic(state, session, "ice", { damage: 40 });
  for (let index = 0; index < 3; index += 1) {
    updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 100, random: () => 0.5 });
  }
  assert.equal(monster.currentHealth, 50);
});

test("공중에서 속박된 슬라임은 즉시 바닥으로 떨어진다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const slime = createMonster({
    templateId: "slime",
    movementStyle: "hop",
    slimeHopState: "jumping",
    slimeHopTimerMs: 260,
    slimeHopProgress: 0.5,
    position: { x: 0, y: 0.8, z: -4.2 },
  });
  spawnPlayerMagic(state, session, "rock", { damage: 10, skillTier: 2, room });
  updateCombatState(state, { monsters: [slime], session, room, elapsedMs: 1000, random: () => 0.99 });
  assert.equal(slime.position.y, 0);
  assert.equal(slime.slimeHopState, "waiting");
  assert.equal(slime.slimeHopProgress, 0);
  assert.equal(slime.immobilizedMs, 2000);
});

test("보스의 근거리 공격 범위는 16칸이고 준비 시간은 2초이며 전용 효과음을 요청한다", () => {
  const state = createCombatState();
  const session = createSession();
  const boss = createSpiritKingBoss({ position: { x: 0, z: -3 } });
  boss.bossPauseCycleMs = 99999;
  boss.bossDarkCooldownMs = 99999;
  boss.attackCooldownMs = 0;
  updateMonsterBehavior(boss, { session, room: { rocks: [] }, combatState: state, elapsedMs: 1, random: () => 0 });
  assert.equal(BOSS_MELEE_PREPARE_MS, 2000);
  assert.equal(BOSS_MELEE_RANGE, 16);
  assert.equal(boss.bossActionPrepareMs, 2000);
  updateMonsterBehavior(boss, { session, room: { rocks: [] }, combatState: state, elapsedMs: 1000, random: () => 0 });
  assert.equal(boss.aiState, MonsterState.ATTACK_PREPARING);
  updateMonsterBehavior(boss, { session, room: { rocks: [] }, combatState: state, elapsedMs: 500, random: () => 0 });
  assert.equal(boss.aiState, MonsterState.ATTACK_PREPARING);
  updateMonsterBehavior(boss, { session, room: { rocks: [] }, combatState: state, elapsedMs: 500, random: () => 0 });
  assert.equal(boss.aiState, MonsterState.ATTACKING);
  assert.ok(session.player.health < session.player.maximumHealth);
  assert.ok(drainCombatSoundEvents(state).some((event) => event.type === "boss-melee"));
});

test("적 처치 시 10% 확률로 최대 체력의 3분의 1을 회복하는 하트를 드롭한다", () => {
  const state = createCombatState();
  const session = createSession();
  session.player.health = 30;
  const monster = createMonster({ position: { x: 0, y: 0, z: -2 }, currentHealth: 20, maximumHealth: 20 });
  const random = () => 0.05;
  spawnPlayerMagic(state, session, "fire", { damage: 30 });
  for (let index = 0; index < 3; index += 1) {
    updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 100, random });
  }
  assert.equal(state.heartDrops.length, 1);
  session.player.z = -2;
  updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 16, random });
  assert.equal(state.heartDrops.length, 0);
  assert.equal(session.player.health, 63.3);
});

test("3스킬은 속성별 전용 공격 형태를 생성한다", () => {
  const room = { rocks: [{ x: 2, z: 2 }] };
  const makeMonsters = () => [
    createMonster({ id: "a", element: "normal", position: { x: 0, y: 0, z: -2 }, currentHealth: 500, maximumHealth: 500 }),
    createMonster({ id: "b", element: "normal", position: { x: 1.5, y: 0, z: -2 }, currentHealth: 500, maximumHealth: 500 }),
    createMonster({ id: "c", element: "normal", position: { x: 2.8, y: 0, z: -2 }, currentHealth: 500, maximumHealth: 500 }),
  ];

  const normalState = createCombatState();
  const normal = spawnPlayerMagic(normalState, createSession(), "normal", { damage: 100, skillTier: 3, room, monsters: makeMonsters() });
  assert.equal(normal.length, 8);
  assert.ok(normal.every((projectile) => projectile.hitRadiusScale >= 2));

  const fireState = createCombatState();
  const fireMonsters = [createMonster({ id: "fire-target", position: { x: 0, y: 0, z: -5 }, currentHealth: 500, maximumHealth: 500 })];
  const fire = spawnPlayerMagic(fireState, createSession(), "fire", { damage: 80, skillTier: 3, room, monsters: fireMonsters });
  assert.equal(fire.radius, 5);
  assert.equal(fireState.meteors.length, 1);
  assert.ok(fireState.meteors[0].y > 5);
  updateCombatState(fireState, { monsters: fireMonsters, session: createSession(), room, elapsedMs: 1000, random: () => 0.9 });
  assert.equal(fireState.statusEffects[0].type, "burn");
  assert.ok(fireState.particles.some((particle) => particle.color === "#777b80" && particle.shape === "circle"));
  assert.ok(drainCombatSoundEvents(fireState).some((event) => event.type === "fire-meteor-impact"));

  const grassState = createCombatState();
  const grassMonsters = makeMonsters();
  spawnPlayerMagic(grassState, createSession(), "grass", { damage: 90, skillTier: 3, room, monsters: grassMonsters });
  assert.equal(grassState.statusEffects.length, 3);
  assert.ok(grassMonsters.every((monster) => monster.immobilizedMs === 5000));

  const rockState = createCombatState();
  const rockSession = createSession();
  const rockMonsters = makeMonsters();
  const rock = spawnPlayerMagic(rockState, rockSession, "rock", { damage: 90, skillTier: 3, room, monsters: rockMonsters });
  assert.equal(rock.radius, 15);
  assert.equal(rock.removesRocks, true);
  updateCombatState(rockState, { monsters: rockMonsters, session: rockSession, room, elapsedMs: 1000, random: () => 0.5 });
  assert.ok(rockState.particles.some((particle) => particle.shape === "square" && particle.velocityY > 0));

  const electricState = createCombatState();
  const electricMonsters = makeMonsters();
  const electric = spawnPlayerMagic(electricState, createSession(), "electric", { damage: 30, skillTier: 3, room, monsters: electricMonsters, random: () => 0.9 });
  assert.equal(electric.length, 3);
  assert.ok(electricMonsters.every((monster) => monster.currentHealth === 455 && monster.immobilizedMs === 3000));
  assert.equal(electricState.verticalLightnings.length, 3);

  const iceState = createCombatState();
  const iceMonsters = makeMonsters();
  spawnPlayerMagic(iceState, createSession(), "ice", { damage: 40, skillTier: 3, room, monsters: iceMonsters, random: () => 0.9 });
  assert.ok(iceMonsters.every((monster) => monster.currentHealth === 460 && monster.immobilizedMs === 3000));

  const lightState = createCombatState();
  const lightSession = createSession();
  const lightMonsters = makeMonsters();
  const light = spawnPlayerMagic(lightState, lightSession, "light", { damage: 100, skillTier: 3, room, monsters: lightMonsters });
  assert.equal(light.sustained, true);
  assert.equal(light.lifeMs, 3000);
  assert.equal(light.damage, 20);
  assert.equal(light.tickEveryMs, 100);
  assert.equal(light.piercing, true);
  assert.equal(lightSession.player.invulnerableMs, 3000);
  assert.equal(lightState.castEffects[0].lifeMs, 3000);
  updateCombatState(lightState, { monsters: lightMonsters, session: lightSession, room, elapsedMs: 100, random: () => 0.9 });
  assert.equal(lightMonsters[0].currentHealth, 480);
  lightSession.player.cameraYaw = Math.PI / 2;
  updateCombatState(lightState, { monsters: lightMonsters, session: lightSession, room, elapsedMs: 16, random: () => 0.9 });
  assert.ok(light.direction.x > 0.99 && Math.abs(light.direction.z) < 0.01);

  const darkState = createCombatState();
  const dark = spawnPlayerMagic(darkState, createSession(), "dark", { damage: 100, skillTier: 3, room, monsters: makeMonsters() });
  assert.equal(dark.radius, 10);
  assert.equal(dark.lifeMs, 5000);
  assert.equal(dark.y, 1.55);

  const darkTarget = createMonster({ id: "black-hole-target", position: { x: 0, y: 0, z: -5 }, currentHealth: 100, maximumHealth: 100 });
  const darkDamageState = createCombatState();
  const darkDamageSession = createSession();
  spawnPlayerMagic(darkDamageState, darkDamageSession, "dark", { damage: 100, skillTier: 3, room, monsters: [darkTarget] });
  updateCombatState(darkDamageState, { monsters: [darkTarget], session: darkDamageSession, room, elapsedMs: 500, random: () => 0.5 });
  assert.equal(darkTarget.currentHealth, 85);

  const waterState = createCombatState();
  const water = spawnPlayerMagic(waterState, createSession(), "water", { damage: 70, skillTier: 3, room, monsters: makeMonsters() });
  assert.equal(water.width, 15);
});

test("보스는 풀 3스킬 피해를 받지만 속박·스턴·블랙홀·파도 이동 효과에는 면역이다", () => {
  const room = { rocks: [] };
  const session = createSession();
  const boss = createSpiritKingBoss({ position: { x: 0, z: 0 } });

  const grassState = createCombatState();
  const healthBeforeVines = boss.currentHealth;
  spawnPlayerMagic(grassState, session, "grass", { damage: 90, skillTier: 3, room, monsters: [boss] });
  assert.equal(grassState.statusEffects.length, 1);
  assert.equal(boss.immobilizedMs ?? 0, 0);
  updateCombatState(grassState, { monsters: [boss], session, room, elapsedMs: 300, random: () => 0.5 });
  assert.equal(boss.currentHealth, healthBeforeVines - 15);
  assert.ok(boss.vineVisualMs > 0);

  const electricState = createCombatState();
  spawnPlayerMagic(electricState, session, "electric", { damage: 30, skillTier: 3, room, monsters: [boss], random: () => 0.5 });
  assert.equal(boss.immobilizedMs ?? 0, 0);

  const waveState = createCombatState();
  const start = { ...boss.position };
  spawnPlayerMagic(waveState, session, "water", { damage: 40, skillTier: 3, room, monsters: [boss] });
  updateCombatState(waveState, { monsters: [boss], session, room, elapsedMs: 200, random: () => 0.5 });
  assert.deepEqual(boss.position, start);

  const blackHoleState = createCombatState();
  boss.position = { x: 0, y: 0, z: -5 };
  const healthBeforeBlackHole = boss.currentHealth;
  spawnPlayerMagic(blackHoleState, session, "dark", { damage: 100, skillTier: 3, room, monsters: [boss] });
  updateCombatState(blackHoleState, { monsters: [boss], session, room, elapsedMs: 1000, random: () => 0.5 });
  assert.equal(boss.currentHealth, healthBeforeBlackHole);
  assert.deepEqual(boss.position, { x: 0, y: 0, z: -5 });
});

test("물 3스킬 파도는 적을 순간이동시키지 않고 진행 방향으로 쓸며 파란 피격 상태를 만든다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const monster = createMonster({ id: "wave-target", position: { x: 0, y: 0, z: 0 }, currentHealth: 300, maximumHealth: 300 });
  spawnPlayerMagic(state, session, "water", { damage: 40, skillTier: 3, room, monsters: [monster], random: () => 0.5 });
  updateCombatState(state, { monsters: [monster], session, room, elapsedMs: 200, enemyTimeScale: 0, random: () => 0.5 });
  assert.equal(monster.currentHealth, 260);
  assert.ok(monster.position.z < -1 && monster.position.z > -7);
  assert.ok(monster.waterHitFlashMs > 0);
  assert.equal(state.particles.some((particle) => particle.color === "#f4fdff"), false);
});

test("어둠 3스킬은 공중 구체 바깥에서 중심으로 빨려드는 파티클을 계속 만든다", () => {
  const state = createCombatState();
  const session = createSession();
  const room = { rocks: [] };
  const blackHole = spawnPlayerMagic(state, session, "dark", { damage: 50, skillTier: 3, room, monsters: [], random: () => 0.5 });
  updateCombatState(state, { monsters: [], session, room, elapsedMs: 60, enemyTimeScale: 0, random: () => 0.25 });
  assert.ok(blackHole.y > 1);
  const inward = state.particles.find((particle) => particle.gravityScale === 0);
  assert.ok(inward);
  const inwardDot = (inward.x - blackHole.x) * inward.velocityX + (inward.z - blackHole.z) * inward.velocityZ;
  assert.ok(inwardDot < 0);
});

test("피격 피해는 공중 숫자와 빨간 피격 상태를 만든다", () => {
  const state = createCombatState();
  const session = createSession();
  const monster = createMonster({ position: { x: 0, y: 0, z: -2 }, currentHealth: 200, maximumHealth: 200 });
  spawnPlayerMagic(state, session, "fire", { damage: 120 });
  for (let index = 0; index < 2; index += 1) updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 100, random: () => 0.9 });
  const number = state.damageNumbers.find((entry) => entry.owner === "player");
  assert.equal(number.damage, 120);
  assert.equal(number.critical, true);
  assert.notDeepEqual({ x: number.x, z: number.z }, { x: monster.position.x, z: monster.position.z });
  assert.ok(monster.hitFlashMs > 0);
});

test("적 시간 배율이 0이면 이동·공격·적 투사체가 모두 멈춘다", () => {
  const state = createCombatState();
  const session = createSession();
  const monster = createMonster({ attackStyle: "ranged", position: { x: 0, y: 0, z: -4 } });
  updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 1000, enemyTimeScale: 0 });
  assert.equal(monster.aiState, MonsterState.IDLE);
  assert.equal(state.projectiles.length, 0);
  assert.deepEqual(monster.position, { x: 0, y: 0, z: -4 });
});

test("보스는 근거리에서도 마법을 고르고 2페이즈에만 12방향 패턴을 사용한다", () => {
  const makeBoss = (z = -20) => {
    const boss = createSpiritKingBoss({ position: { x: 0, z } });
    boss.bossPauseCycleMs = 99999;
    boss.bossDarkCooldownMs = 99999;
    boss.attackCooldownMs = 0;
    return boss;
  };
  const room = { rocks: [] };

  const nearState = createCombatState();
  const nearBoss = makeBoss(-3);
  updateMonsterBehavior(nearBoss, { session: createSession(), room, monsters: [nearBoss], combatState: nearState, elapsedMs: 1, random: () => 0.2 });
  assert.notEqual(nearBoss.bossPendingAction.type, "melee");

  const radialState = createCombatState();
  const radialBoss = makeBoss(-20);
  updateMonsterBehavior(radialBoss, { session: createSession(), room, monsters: [radialBoss], combatState: radialState, elapsedMs: 1, random: () => 0.999 });
  assert.equal(radialState.trajectoryWarnings.length, 0);
  radialBoss.bossPendingAction = null;
  radialBoss.bossActionPrepareMs = 0;
  radialBoss.attackCooldownMs = 0;
  radialBoss.currentHealth = 1500;
  assert.equal(isBossPhaseTwo(radialBoss), true);
  const radialValues = [0.999, 0, 0.4, 0.8, 0, 0.4, 0.8, 0, 0.4, 0.8, 0, 0.4, 0.8];
  updateMonsterBehavior(radialBoss, { session: createSession(), room, monsters: [radialBoss], combatState: radialState, elapsedMs: 1, random: () => radialValues.shift() ?? 0 });
  assert.equal(radialState.trajectoryWarnings.length, 12);
  updateMonsterBehavior(radialBoss, { session: createSession(), room, monsters: [radialBoss], combatState: radialState, elapsedMs: 2000, random: () => 0 });
  assert.equal(radialState.projectiles.length, 12);
  assert.deepEqual(new Set(radialState.projectiles.map((projectile) => projectile.element)), new Set(["fire", "water", "grass"]));
  assert.ok(radialState.projectiles.every((projectile) => projectile.y < 1));

  const darkState = createCombatState();
  const darkBoss = makeBoss(-20);
  updateMonsterBehavior(darkBoss, { session: createSession(), room, monsters: [darkBoss], combatState: darkState, elapsedMs: 1, random: () => 0.55 });
  updateMonsterBehavior(darkBoss, { session: createSession(), room, monsters: [darkBoss], combatState: darkState, elapsedMs: 1000, random: () => 0 });
  assert.equal(darkState.scheduledActions.length, 3);
  assert.equal(darkState.scheduledActions[0].radius, 1);
  updateCombatState(darkState, { monsters: [darkBoss], session: createSession(), room, elapsedMs: 1, random: () => 0 });
  assert.equal(darkState.areaAttacks[0].warningVisual, "dark-magic-circle");

  const electricState = createCombatState();
  const electricBoss = makeBoss(-20);
  updateMonsterBehavior(electricBoss, { session: createSession(), room, monsters: [electricBoss], combatState: electricState, elapsedMs: 1, random: () => 0.35 });
  assert.equal(electricBoss.bossPendingAction.element, "electric");
  assert.equal(electricState.trajectoryWarnings.length, 4);

  const lightningState = createCombatState();
  const lightningBoss = makeBoss(-20);
  updateMonsterBehavior(lightningBoss, { session: createSession(), room, monsters: [lightningBoss], combatState: lightningState, elapsedMs: 1, random: () => 0.65 });
  updateMonsterBehavior(lightningBoss, { session: createSession(), room, monsters: [lightningBoss], combatState: lightningState, elapsedMs: 1000, random: () => 0 });
  assert.equal(lightningState.scheduledActions.length, 3);
  assert.ok(lightningState.scheduledActions.every((action) => action.type === "boss-lightning-target"));

  const summonState = createCombatState();
  const summonBoss = makeBoss(-20);
  const summonMonsters = [summonBoss];
  updateMonsterBehavior(summonBoss, { session: createSession(), room, monsters: summonMonsters, combatState: summonState, elapsedMs: 1, random: () => 0.75 });
  updateMonsterBehavior(summonBoss, { session: createSession(), room, monsters: summonMonsters, combatState: summonState, elapsedMs: 1000, random: () => 0 });
  assert.equal(summonState.groundMagicCircles.length, 3);
  assert.equal(summonState.scheduledActions[0].type, "boss-summon-complete");
  assert.ok(drainCombatSoundEvents(summonState).some((event) => event.type === "boss-summon"));
  assert.equal(summonMonsters.length, 1);
  updateCombatState(summonState, { monsters: summonMonsters, session: createSession(), room, elapsedMs: 1200, random: () => 0 });
  assert.equal(summonMonsters.filter((monster) => monster.templateId === "warriorSpirit").length, 2);
  assert.equal(summonMonsters.filter((monster) => monster.templateId === "mageSpirit").length, 1);
});

test("빛 궁극기 장은 10초간 0.1초마다 7.5 피해를 주고 공격·방어를 강화한다", () => {
  const state = createCombatState();
  const session = createSession();
  session.player.ultimate = 100;
  const monster = createMonster({ position: { x: 0, y: 0, z: -1 }, currentHealth: 500, maximumHealth: 500 });
  const field = spawnPlayerUltimate(state, session, [[[ { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 } ]]]);
  assert.equal(field.lifeMs, 10000);
  assert.equal(session.player.ultimate, 0);
  assert.equal(calculateIncomingPlayerDamage(session.player, 100, "normal"), 20);
  updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 100, random: () => 0.9 });
  assert.equal(monster.currentHealth, 492.5);
  spawnPlayerMagic(state, session, "fire", { damage: 20 });
  for (let index = 0; index < 3; index += 1) {
    updateCombatState(state, { monsters: [monster], session, room: { rocks: [] }, elapsedMs: 100, random: () => 0.9 });
  }
  assert.ok(monster.currentHealth <= 440);
});

test("보스의 바위 공격 범위 경고는 기존보다 1초 늘어난 2초다", () => {
  assert.equal(BOSS_ROCK_WARNING_DURATION_MS, 2000);
  const state = createCombatState();
  const boss = createSpiritKingBoss({ position: { x: 0, z: -20 } });
  boss.bossPauseCycleMs = 99999;
  boss.bossDarkCooldownMs = 99999;
  boss.attackCooldownMs = 0;
  const room = { rocks: [] };
  const session = createSession();
  updateMonsterBehavior(boss, { session, room, monsters: [boss], combatState: state, elapsedMs: 1, random: () => 0.42 });
  updateMonsterBehavior(boss, { session, room, monsters: [boss], combatState: state, elapsedMs: 1000, random: () => 0 });
  assert.equal(state.areaAttacks[0].element, "rock");
  assert.equal(state.areaAttacks[0].warningMs, BOSS_ROCK_WARNING_DURATION_MS);
});
