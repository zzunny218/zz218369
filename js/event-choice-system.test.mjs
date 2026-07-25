import assert from "node:assert/strict";
import test from "node:test";
import { applyEventChoice, createEventChoices, createMissingSkillChoice } from "./event-choice-system.js";
import { createPlayerProgress } from "./player-resources.js";

test("선택지 방은 서로 다른 보상 두 개를 제시한다", () => {
  let value = 0;
  const choices = createEventChoices({ random: () => (value = (value + 0.17) % 1) });
  assert.equal(choices.length, 2);
  assert.equal(new Set(choices.map((choice) => choice.type)).size, 2);
});

test("회복 선택지는 최대 체력의 40~80%를 회복한다", () => {
  const values = [0.9, 0.8, 0.7, 0.1, 0.999999, 0.5];
  const choices = createEventChoices({ random: () => values.shift() ?? 0.5 });
  const healing = choices.find((choice) => choice.type === "heal");
  assert.ok(healing);
  assert.ok(healing.ratio >= 0.4 && healing.ratio <= 0.8);
  assert.match(healing.description, /최대 체력의 \d+% 회복/);
});

test("공격·체력·골드·회복 선택지가 플레이어 진행도에 적용된다", () => {
  const progress = createPlayerProgress();
  progress.health = 40;
  applyEventChoice(progress, { type: "attack", multiplier: 1.2 });
  applyEventChoice(progress, { type: "health", multiplier: 1.1 });
  applyEventChoice(progress, { type: "gold", amount: 35 });
  applyEventChoice(progress, { type: "heal", ratio: 0.4 });
  assert.equal(progress.attackMultiplier, 1.2);
  assert.equal(progress.maximumHealth, 110);
  assert.equal(progress.health, 94);
  assert.equal(progress.gold, 35);
});

test("전투 완료 보상은 현재 갖고 있지 않은 2·3스킬만 후보로 만든다", () => {
  const progress = createPlayerProgress();
  progress.unlockedSecondSkills = ["fire"];
  progress.unlockedThirdSkills = [];
  const cards = [{ id: "fire" }, { id: "water" }];
  const thirdSkill = createMissingSkillChoice({
    progress,
    cards,
    getName: (element, tier) => `${element}-${tier}`,
    random: () => 0,
  });
  assert.deepEqual(
    { element: thirdSkill.element, skillTier: thirdSkill.skillTier, description: thirdSkill.description },
    { element: "fire", skillTier: 3, description: "fire-3 카드 획득" },
  );

  progress.unlockedThirdSkills = ["fire"];
  const secondSkill = createMissingSkillChoice({ progress, cards, random: () => 0 });
  assert.equal(secondSkill.element, "water");
  assert.equal(secondSkill.skillTier, 2);
});
