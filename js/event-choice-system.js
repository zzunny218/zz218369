const CHOICE_TYPES = Object.freeze(["attack", "health", "gold", "heal"]);

function clampRandom(random) {
  return Math.min(0.999999, Math.max(0, Number(random()) || 0));
}

function roundTenth(value) {
  return Math.round(value * 10) / 10;
}

function createChoice(type, random) {
  if (type === "attack" || type === "health") {
    const multiplier = roundTenth(1.1 + Math.floor(clampRandom(random) * 3) * 0.1);
    return {
      id: `${type}-${multiplier}`,
      type,
      multiplier,
      label: type === "attack" ? "공격력 강화" : "최대 체력 강화",
      description: `${multiplier.toFixed(1)}배로 증가`,
    };
  }
  if (type === "heal") {
    const percentage = 40 + Math.floor(clampRandom(random) * 5) * 10;
    return {
      id: `${type}-${percentage}`,
      type,
      ratio: percentage / 100,
      label: "체력 회복",
      description: `최대 체력의 ${percentage}% 회복`,
    };
  }
  const minimum = 20;
  const maximum = 50;
  const amount = minimum + Math.floor(clampRandom(random) * (maximum - minimum + 1));
  return {
    id: `${type}-${amount}`,
    type,
    amount,
    label: type === "gold" ? "골드 주머니" : "회복의 샘",
    description: type === "gold" ? `${amount}G 획득` : `체력 ${amount} 회복`,
  };
}

/** 네 보상 중 서로 다른 두 종류를 제시한다. */
export function createEventChoices({ random = Math.random } = {}) {
  const ordered = [...CHOICE_TYPES]
    .map((type) => ({ type, order: clampRandom(random) }))
    .sort((left, right) => left.order - right.order);
  return ordered.slice(0, 2).map(({ type }) => createChoice(type, random));
}

/** 현재 해금 상태에서 아직 갖지 않은 2·3스킬 중 하나를 보상 후보로 만든다. */
export function createMissingSkillChoice({
  progress,
  cards = [],
  getName = (element, skillTier) => `${element} ${skillTier}스킬`,
  random = Math.random,
} = {}) {
  if (!progress) return null;
  const unlockedSecond = new Set(progress.unlockedSecondSkills ?? []);
  const unlockedThird = new Set(progress.unlockedThirdSkills ?? []);
  const candidates = cards.flatMap((card) => {
    const rewards = [];
    if (!unlockedSecond.has(card.id)) rewards.push({ card, skillTier: 2 });
    if (unlockedSecond.has(card.id) && !unlockedThird.has(card.id)) rewards.push({ card, skillTier: 3 });
    return rewards;
  });
  if (candidates.length === 0) return null;
  const selected = candidates[Math.floor(clampRandom(random) * candidates.length)];
  const skillName = getName(selected.card.id, selected.skillTier);
  return {
    id: `skill-${selected.card.id}-${selected.skillTier}`,
    type: "skill",
    element: selected.card.id,
    skillTier: selected.skillTier,
    label: "새로운 스킬 획득",
    description: `${skillName} 카드 획득`,
  };
}

export function applyEventChoice(progress, choice) {
  if (!progress || !choice) return false;
  if (choice.type === "attack") {
    progress.attackMultiplier = roundTenth((progress.attackMultiplier ?? 1) * choice.multiplier);
  } else if (choice.type === "health") {
    const previousMaximum = progress.maximumHealth;
    progress.maximumHealth = roundTenth(previousMaximum * choice.multiplier);
    progress.health = Math.min(progress.maximumHealth, roundTenth(progress.health + progress.maximumHealth - previousMaximum));
  } else if (choice.type === "gold") {
    progress.gold += choice.amount;
  } else if (choice.type === "heal") {
    const healingAmount = Number.isFinite(choice.ratio)
      ? progress.maximumHealth * choice.ratio
      : choice.amount;
    progress.health = Math.min(progress.maximumHealth, roundTenth(progress.health + healingAmount));
  } else {
    return false;
  }
  return true;
}
