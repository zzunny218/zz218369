import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerProgress } from "./player-resources.js";
import {
  THIRD_SKILL_OFFER_CHANCE,
  createRestockedShopInventory,
  createShopInventory,
  purchaseShopItem,
} from "./shop-system.js";

test("상점은 서로 다른 2스킬 카드 세 종류를 50G에, 회복 아이템을 30G에 판다", () => {
  const inventory = createShopInventory({ random: () => 0.5 });
  const skills = inventory.filter((item) => item.type === "second-skill");
  const healing = inventory.find((item) => item.type === "healing");
  assert.equal(skills.length, 3);
  assert.equal(new Set(skills.map((item) => item.element)).size, 3);
  assert.ok(skills.every((item) => item.price === 50));
  assert.equal(healing.price, 30);
  assert.equal(healing.healingAmount, 50);
});

test("G가 충분하면 2스킬을 해금하고 같은 카드는 다시 살 수 없다", () => {
  const progress = createPlayerProgress();
  progress.gold = 200;
  const item = createShopInventory({ random: () => 0 })[0];
  assert.equal(purchaseShopItem(progress, item).succeeded, true);
  assert.equal(progress.gold, 150);
  assert.deepEqual(progress.unlockedSecondSkills, [item.element]);
  assert.equal(purchaseShopItem(progress, item).reason, "already-owned");
});

test("다른 상점은 이전 상점에서 제시한 2스킬을 다시 제시하지 않는다", () => {
  const first = createShopInventory({ random: () => 0.5 });
  const excludedElements = first.filter((item) => item.type === "second-skill").map((item) => item.element);
  const second = createShopInventory({ random: () => 0.5, excludedElements, includeHealing: false });
  assert.equal(second.some((item) => item.type === "healing"), false);
  assert.equal(second.some((item) => excludedElements.includes(item.element)), false);
});

test("후반 전투와 보스 상점은 제시 이력이 한 바퀴 돌면 재입고되어 비지 않는다", () => {
  const allElements = ["normal", "rock", "water", "fire", "electric", "grass", "ice", "light", "dark"];
  const { inventory, cycleReset } = createRestockedShopInventory({
    random: () => 0.5,
    offeredElements: allElements,
    ownedElements: ["normal"],
  });
  assert.equal(cycleReset, true);
  assert.equal(inventory.filter((item) => item.type === "second-skill").length, 3);
  assert.equal(inventory.some((item) => item.type === "healing"), true);
  assert.equal(inventory.some((item) => item.element === "normal"), false);
});

test("2스킬을 가진 속성은 3스킬 카드가 75G로 상점에 등장한다", () => {
  const inventory = createShopInventory({
    random: () => 0,
    excludedElements: ["fire"],
    eligibleThirdSkillElements: ["fire"],
  });
  const third = inventory.find((item) => item.type === "third-skill" && item.element === "fire");
  assert.equal(third.price, 75);
  const progress = createPlayerProgress();
  progress.gold = 100;
  progress.unlockedSecondSkills.push("fire");
  assert.equal(purchaseShopItem(progress, third).succeeded, true);
  assert.equal(progress.gold, 25);
  assert.deepEqual(progress.unlockedThirdSkills, ["fire"]);
});

test("보유한 2스킬의 3스킬은 다음 상점에서 확률로만 상품 후보에 들어간다", () => {
  assert.ok(THIRD_SKILL_OFFER_CHANCE > 0 && THIRD_SKILL_OFFER_CHANCE < 1);
  const missed = createShopInventory({
    random: () => 0.99,
    excludedElements: ["fire"],
    eligibleThirdSkillElements: ["fire"],
  });
  assert.equal(missed.some((item) => item.type === "third-skill"), false);
});

test("남은 2·3스킬이 셋 이상이면 상점에 마법 상품이 반드시 세 개 나온다", () => {
  const allElements = ["normal", "rock", "water", "fire", "electric", "grass", "ice", "light", "dark"];
  const inventory = createShopInventory({
    random: () => 0.99,
    excludedElements: allElements,
    eligibleThirdSkillElements: ["fire", "water", "ice"],
  });
  assert.equal(inventory.filter((item) => item.type === "third-skill").length, 3);
});

test("돈 무한 개발자 상태에서는 구매해도 골드가 줄지 않는다", () => {
  const progress = createPlayerProgress();
  progress.infiniteGold = true;
  const item = createShopInventory({ random: () => 0.5 })[0];
  assert.equal(purchaseShopItem(progress, item).succeeded, true);
  assert.equal(progress.gold, 0);
});
