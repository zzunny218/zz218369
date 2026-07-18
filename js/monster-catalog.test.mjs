import assert from "node:assert/strict";
import test from "node:test";
import { createSeededRandom } from "./dungeon-generator.js";
import {
  MONSTER_ATTACK_POWER_MULTIPLIER,
  MONSTER_MOVE_SPEED_MULTIPLIER,
  calculateMonsterAttackDamage,
  createMonsterInstance,
  createSpiritKingBoss,
  generateRoomMonsters,
  getMonsterTemplates,
  scaleMonsterForStage,
} from "./monster-catalog.js";

test("모든 몬스터의 기본 공격력은 기존 수치보다 30% 낮다", () => {
  const template = getMonsterTemplates({ chapter: 1 })[0];
  const monster = createMonsterInstance(template, { random: () => 0 });
  const boss = createSpiritKingBoss();
  assert.equal(MONSTER_ATTACK_POWER_MULTIPLIER, 0.7);
  assert.equal(monster.stats.attack, Math.round(template.stats.attack * 0.7 * 10) / 10);
  assert.equal(boss.stats.attack, 25.2);
});

test("모든 몬스터와 보스의 이동속도는 기존의 3분의 2로 낮아진다", () => {
  const template = getMonsterTemplates({ chapter: 1 })[0];
  const monster = createMonsterInstance(template, { random: () => 0 });
  const boss = createSpiritKingBoss();
  assert.equal(MONSTER_MOVE_SPEED_MULTIPLIER, 2 / 3);
  assert.equal(monster.stats.moveSpeed, Math.round(template.stats.moveSpeed * 2 / 3 * 1000) / 1000);
  assert.equal(boss.stats.moveSpeed, 0.7);
});

test("1챕터 근접 몬스터 후보에는 슬라임과 전사 정령만 포함된다", () => {
  const names = getMonsterTemplates({ chapter: 1, spawnClass: "melee" }).map((monster) => monster.name).sort();
  assert.deepEqual(names, ["슬라임", "전사 정령"].sort());
});

test("전투 노드 단계마다 일반 적 체력과 공격력이 1.2배 누적된다", () => {
  const template = getMonsterTemplates({ chapter: 1 })[0];
  const monster = createMonsterInstance(template, { random: () => 0 });
  const baseHealth = monster.stats.health;
  const baseAttack = monster.stats.attack;
  scaleMonsterForStage(monster, 4);
  assert.equal(monster.stats.health, Math.round(baseHealth * 1.2 ** 3));
  assert.equal(monster.stats.attack, Math.round(baseAttack * 1.2 ** 3 * 10) / 10);
  assert.equal(monster.currentHealth, monster.maximumHealth);
});

test("타락한 정령왕 보스는 체력 4000의 거대한 전용 몬스터다", () => {
  const boss = createSpiritKingBoss();
  assert.equal(boss.name, "타락한 정령왕");
  assert.equal(boss.maximumHealth, 4000);
  assert.equal(boss.currentHealth, 4000);
  assert.equal(boss.isBoss, true);
  assert.ok(boss.stats.size >= 3);
});

test("근접 정령은 전체 감속 적용 후 이동속도가 다시 1.5배 증가한다", () => {
  const template = getMonsterTemplates({ chapter: 1 }).find((candidate) => candidate.templateId === "warriorSpirit");
  const monster = createMonsterInstance(template, { random: () => 0 });
  assert.equal(monster.stats.moveSpeed, Math.round(template.stats.moveSpeed * 2 / 3 * 1000) / 1000 * 1.5);
});

test("몬스터는 템플릿 수치 복사 후 허용 속성 중 하나를 받는다", () => {
  const result = generateRoomMonsters({ chapter: 1, random: createSeededRandom(12), minimumCount: 5, maximumCount: 5 });
  assert.equal(result.monsters.length, 5);
  for (const monster of result.monsters) {
    assert.equal(monster.valuesAreTemporary, true);
    assert.ok(monster.stats.health > 0);
    assert.ok(["normal", "fire", "water", "grass"].includes(monster.element));
    assert.equal(Math.abs(monster.position.x % 1), 0);
    assert.equal(Math.abs(monster.position.z % 1), 0);
  }
});

test("전투방의 몬스터 수는 실제 개체 기준 3~5마리다", () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const result = generateRoomMonsters({ chapter: 1, random: createSeededRandom(seed) });
    assert.ok(result.count >= 3 && result.count <= 5);
  }
});

test("슬라임과 빅 슬라임은 문 주변 3×3 안에 생성되지 않는다", () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const result = generateRoomMonsters({
      chapter: 1,
      random: createSeededRandom(seed),
      minimumCount: 5,
      maximumCount: 5,
      doorDirections: ["north", "east"],
    });
    for (const monster of result.monsters.filter((candidate) => (
      candidate.templateId === "slime" || candidate.templateId === "bigSlime"
    ))) {
      assert.equal(monster.position.z <= -5 && Math.abs(monster.position.x) <= 1, false);
      assert.equal(monster.position.x >= 5 && Math.abs(monster.position.z) <= 1, false);
    }
  }
});

test("슬라임류 몬스터는 점프 이동 스타일을 가진다", () => {
  const slimeTemplate = getMonsterTemplates({ chapter: 1 }).find((template) => template.templateId === "slime");
  const slime = createMonsterInstance(slimeTemplate, { random: () => 0, instanceIndex: 0 });
  assert.equal(slime.movementStyle, "hop");
  assert.equal(slime.slimeHopState, "waiting");
  assert.equal(slime.slimeHopTimerMs, 300);
});

test("몬스터 공격에도 속성 상성 배율을 적용한다", () => {
  const monster = { element: "fire", stats: { attack: 100 } };
  assert.equal(calculateMonsterAttackDamage(monster, "grass"), 125);
  assert.equal(calculateMonsterAttackDamage(monster, "water"), 80);
});

test("최신 확정 규칙대로 물은 얼음에 불리하다", () => {
  const monster = { element: "water", stats: { attack: 100 } };
  assert.equal(calculateMonsterAttackDamage(monster, "ice"), 80);
});

test("요정은 전체 감속 뒤에도 작은 히트박스로 낮게 공중에 뜬다", () => {
  const fairyTemplate = getMonsterTemplates({ chapter: 1 }).find((template) => template.templateId === "fairy");
  const fairy = createMonsterInstance(fairyTemplate, { random: () => 0, position: { x: 2, z: 3 } });
  assert.equal(fairy.stats.moveSpeed, Math.round(2.9 * 2 / 3 * 1000) / 1000);
  assert.ok(fairy.hitboxScale < 0.6);
  assert.ok(fairy.position.y > 0 && fairy.position.y < 1);
  assert.equal(fairy.aiState, "idle");
});
