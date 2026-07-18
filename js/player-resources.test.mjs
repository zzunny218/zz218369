import assert from "node:assert/strict";
import test from "node:test";
import {
  addUltimateFromDamage,
  createPlayerProgress,
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

test("룬을 그리는 중 마나가 0이 되면 즉시 취소 조건이 성립한다", () => {
  const player = createPlayerProgress();
  player.mana = 0;
  assert.equal(shouldCancelRuneDrawing(player, true), true);
  assert.equal(shouldCancelRuneDrawing(player, false), false);
});

test("궁극기 게이지는 실제 피해의 30분의 1만큼 증가하고 최대치를 넘지 않는다", () => {
  const player = createPlayerProgress();
  addUltimateFromDamage(player, 90);
  assert.equal(player.ultimate, 3);
  addUltimateFromDamage(player, 3000);
  assert.equal(player.ultimate, 100);
});
