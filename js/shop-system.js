export const SECOND_SKILL_PRICE = 50;
export const THIRD_SKILL_PRICE = 75;
export const HEALING_ITEM_PRICE = 30;
export const HEALING_ITEM_AMOUNT = 50;
export const THIRD_SKILL_OFFER_CHANCE = 0.35;

const FIELD_SHOP_ELEMENTS = ["normal", "rock", "water", "fire", "electric", "grass", "ice", "light", "dark"];

function shuffled(items, random) {
  return [...items]
    .map((value) => ({ value, order: random() }))
    .sort((left, right) => left.order - right.order)
    .map(({ value }) => value);
}

/** 필드 상점에는 빛·어둠을 제외한 무작위 2스킬 카드 세 종류와 회복 아이템이 놓인다. */
export function createShopInventory({
  random = Math.random,
  excludedElements = [],
  excludedItemKeys = [],
  eligibleThirdSkillElements = [],
  ownedThirdSkillElements = [],
  includeHealing = true,
} = {}) {
  const excluded = new Set(excludedElements);
  const excludedKeys = new Set(excludedItemKeys);
  const ownedThird = new Set(ownedThirdSkillElements);
  const secondSkillItems = FIELD_SHOP_ELEMENTS.filter((element) => !excluded.has(element)).map((element) => ({
    id: `second-skill-${element}`,
    type: "second-skill",
    element,
    price: SECOND_SKILL_PRICE,
  }));
  const thirdSkillItems = [...new Set(eligibleThirdSkillElements)]
    .filter((element) => FIELD_SHOP_ELEMENTS.includes(element) && !ownedThird.has(element))
    .map((element) => ({
      id: `third-skill-${element}`,
      type: "third-skill",
      element,
      price: THIRD_SKILL_PRICE,
    }));
  const thirdSkillCandidates = thirdSkillItems.filter((item) => !excludedKeys.has(item.id));
  const availableThirdSkills = shuffled(
    thirdSkillCandidates.filter(() => random() < THIRD_SKILL_OFFER_CHANCE),
    random,
  );
  const availableSecondSkills = shuffled(secondSkillItems.filter((item) => !excludedKeys.has(item.id)), random);
  const skillPool = [...availableThirdSkills, ...availableSecondSkills];
  const remainingSkillCount = availableSecondSkills.length + thirdSkillCandidates.length;
  if (remainingSkillCount >= 3 && skillPool.length < 3) {
    const alreadyIncluded = new Set(skillPool.map((item) => item.id));
    skillPool.push(...shuffled(
      thirdSkillCandidates.filter((item) => !alreadyIncluded.has(item.id)),
      random,
    ).slice(0, 3 - skillPool.length));
  }
  const skillItems = shuffled(skillPool, random).slice(0, 3);
  const healingItem = {
      id: "healing-item",
      type: "healing",
      price: HEALING_ITEM_PRICE,
      healingAmount: HEALING_ITEM_AMOUNT,
  };
  return includeHealing ? [...skillItems, healingItem] : skillItems;
}

export function createRestockedShopInventory({
  random = Math.random,
  offeredElements = [],
  ownedElements = [],
  eligibleThirdSkillElements = [],
  ownedThirdSkillElements = [],
  offeredItemKeys = [],
  includeHealing = true,
} = {}) {
  const owned = new Set(ownedElements);
  const ownedThird = new Set(ownedThirdSkillElements);
  const availableSecondSkillCount = FIELD_SHOP_ELEMENTS.filter((element) => !owned.has(element)).length;
  const unownedThirdSkillKeys = [...new Set(eligibleThirdSkillElements)]
    .filter((element) => FIELD_SHOP_ELEMENTS.includes(element) && !ownedThird.has(element))
    .map((element) => `third-skill-${element}`);
  const allThirdSkillOffersExhausted = availableSecondSkillCount === 0
    && unownedThirdSkillKeys.length > 0
    && unownedThirdSkillKeys.every((key) => offeredItemKeys.includes(key));
  const availableSkillCount = availableSecondSkillCount + unownedThirdSkillKeys.length;
  const expectedSkillCount = Math.min(3, availableSkillCount);
  let cycleReset = false;
  let inventory = createShopInventory({
    random,
    excludedElements: [...new Set([...offeredElements, ...owned])],
    excludedItemKeys: offeredItemKeys,
    eligibleThirdSkillElements,
    ownedThirdSkillElements,
    includeHealing,
  });
  if (allThirdSkillOffersExhausted
    || inventory.filter((item) => item.type === "second-skill" || item.type === "third-skill").length < expectedSkillCount) {
    cycleReset = true;
    inventory = createShopInventory({
      random,
      excludedElements: [...owned],
      eligibleThirdSkillElements,
      ownedThirdSkillElements,
      includeHealing,
    });
  }
  return { inventory, cycleReset };
}

export function purchaseShopItem(progress, item) {
  if (!item) return { succeeded: false, reason: "missing-item" };
  if (item.type === "second-skill" && progress.unlockedSecondSkills.includes(item.element)) {
    return { succeeded: false, reason: "already-owned" };
  }
  if (item.type === "third-skill" && progress.unlockedThirdSkills.includes(item.element)) {
    return { succeeded: false, reason: "already-owned" };
  }
  if (item.type === "third-skill" && !progress.unlockedSecondSkills.includes(item.element)) {
    return { succeeded: false, reason: "second-skill-required" };
  }
  if (item.type === "healing" && progress.health >= progress.maximumHealth) {
    return { succeeded: false, reason: "full-health" };
  }
  if (!progress.infiniteGold && progress.gold < item.price) {
    return { succeeded: false, reason: "not-enough-gold" };
  }

  if (!progress.infiniteGold) progress.gold -= item.price;
  if (item.type === "second-skill") {
    progress.unlockedSecondSkills.push(item.element);
  } else if (item.type === "third-skill") {
    progress.unlockedThirdSkills.push(item.element);
  } else if (item.type === "healing") {
    progress.health = Math.min(progress.maximumHealth, progress.health + item.healingAmount);
  }
  return { succeeded: true, item };
}
