import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ATTACK_POWER,
  addUltimateFromDamage,
  calculatePlayerAttackDamage,
  createPlayerProgress,
  hasEnoughManaToCast,
  hasManaRemaining,
  MINIMUM_MAGIC_MANA,
  resetPlayerAfterDeath,
  shouldCancelRuneDrawing,
  startPlayerCastCooldown,
  updatePlayerCastCooldown,
  updatePlayerMana,
} from "./player-resources.js";

test("플레이어는 마나 100, 궁극기 0, G 0으로 시작한다", () => {
  const player = createPlayerProgress();
  assert.equal(player.mana, 100);
  assert.equal(player.ultimate, 0);
  assert.equal(player.gold, 0);
  assert.equal(player.attackPower, DEFAULT_ATTACK_POWER);
});

test("개발자 공격력 10000은 기본 피해를 100배로 만들고 기존 공격 배율도 유지한다", () => {
  const player = createPlayerProgress();
  player.attackPower = 10000;
  assert.equal(calculatePlayerAttackDamage(100, player), 10000);
  player.attackMultiplier = 1.2;
  assert.equal(calculatePlayerAttackDamage(50, player), 6000);
});

test("마법 사용 후 1.5초 동안 다시 사용할 수 없다", () => {
  const player = createPlayerProgress();
  startPlayerCastCooldown(player);
  assert.equal(player.castCooldownMs, 1500);
  updatePlayerCastCooldown(player, 900);
  assert.equal(player.castCooldownMs, 600);
  updatePlayerCastCooldown(player, 600);
  assert.equal(player.castCooldownMs, 0);
});

test("사망하면 체력을 회복하고 G와 궁극기 게이지를 초기화한다", () => {
  const player = createPlayerProgress();
  player.health = 0;
  player.gold = 83;
  player.ultimate = 46;
  resetPlayerAfterDeath(player);
  assert.equal(player.health, 100);
  assert.equal(player.gold, 0);
  assert.equal(player.ultimate, 0);
});

test("마나는 0.1초마다 0.6 회복되고 룬을 그릴 때는 초당 15 소모된다", () => {
  const player = createPlayerProgress();
  player.mana = 50;
  updatePlayerMana(player, 100);
  assert.equal(player.mana, 50.6);
  updatePlayerMana(player, 100, { isDrawing: true });
  assert.ok(Math.abs(player.mana - 49.7) < 0.000001);
  updatePlayerMana(player, 100, { isDrawing: true, drawDrainMultiplier: 2 });
  assert.ok(Math.abs(player.mana - 47.3) < 0.000001);
});

test("마나 30 이하는 신규 시전만 막고 진행 중인 룬은 마나 0에서 취소한다", () => {
  const player = createPlayerProgress();
  player.mana = MINIMUM_MAGIC_MANA;
  assert.equal(shouldCancelRuneDrawing(player, true), false);
  assert.equal(shouldCancelRuneDrawing(player, false), false);
  assert.equal(hasEnoughManaToCast(player), false);
  assert.equal(hasManaRemaining(player), true);
  player.mana = MINIMUM_MAGIC_MANA + 0.1;
  assert.equal(hasEnoughManaToCast(player), true);
  player.mana = 0;
  assert.equal(shouldCancelRuneDrawing(player, true), true);
  assert.equal(hasManaRemaining(player), false);
});

test("궁극기 게이지는 실제 피해의 30분의 1만큼 증가하고 최대치를 넘지 않는다", () => {
  const player = createPlayerProgress();
  addUltimateFromDamage(player, 90);
  assert.equal(player.ultimate, 3);
  addUltimateFromDamage(player, 3000);
  assert.equal(player.ultimate, 100);
});
