export const DEFAULT_MAXIMUM_HEALTH = 100;
export const DEFAULT_MAXIMUM_MANA = 100;
export const DEFAULT_MAXIMUM_ULTIMATE = 100;
export const MANA_DRAW_DRAIN_PER_100_MS = 1.5;
export const MANA_RECOVERY_PER_100_MS = 0.6;
export const MAGIC_CAST_COOLDOWN_MS = 1500;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/** 한 번의 게임 진행 동안 전투 노드와 상점 사이에서 유지되는 플레이어 상태다. */
export function createPlayerProgress({ nickname = "마법사" } = {}) {
  return {
    nickname,
    health: DEFAULT_MAXIMUM_HEALTH,
    maximumHealth: DEFAULT_MAXIMUM_HEALTH,
    mana: DEFAULT_MAXIMUM_MANA,
    maximumMana: DEFAULT_MAXIMUM_MANA,
    ultimate: 0,
    maximumUltimate: DEFAULT_MAXIMUM_ULTIMATE,
    gold: 0,
    castCooldownMs: 0,
    attackMultiplier: 1,
    unlockedSecondSkills: [],
    unlockedThirdSkills: [],
    infiniteHealth: false,
    infiniteGold: false,
  };
}

export function copyProgressToPlayer(progress, player) {
  player.nickname = progress.nickname;
  player.health = progress.health;
  player.maximumHealth = progress.maximumHealth;
  player.mana = progress.mana;
  player.maximumMana = progress.maximumMana;
  player.ultimate = progress.ultimate;
  player.maximumUltimate = progress.maximumUltimate;
  player.gold = progress.gold;
  player.castCooldownMs = progress.castCooldownMs ?? 0;
  player.attackMultiplier = progress.attackMultiplier ?? 1;
  player.unlockedSecondSkills = [...progress.unlockedSecondSkills];
  player.unlockedThirdSkills = [...(progress.unlockedThirdSkills ?? [])];
  player.infiniteHealth = Boolean(progress.infiniteHealth);
  player.infiniteGold = Boolean(progress.infiniteGold);
  return player;
}

export function copyPlayerToProgress(player, progress) {
  progress.nickname = player.nickname ?? progress.nickname ?? "마법사";
  progress.health = player.health;
  progress.maximumHealth = player.maximumHealth;
  progress.mana = player.mana;
  progress.maximumMana = player.maximumMana;
  progress.ultimate = player.ultimate;
  progress.maximumUltimate = player.maximumUltimate;
  progress.gold = player.gold;
  progress.castCooldownMs = player.castCooldownMs ?? 0;
  progress.attackMultiplier = player.attackMultiplier ?? 1;
  progress.unlockedSecondSkills = [...(player.unlockedSecondSkills ?? [])];
  progress.unlockedThirdSkills = [...(player.unlockedThirdSkills ?? [])];
  progress.infiniteHealth = Boolean(player.infiniteHealth);
  progress.infiniteGold = Boolean(player.infiniteGold);
  return progress;
}

/** 마나는 항상 회복되며, 룬을 실제로 그리는 동안에는 회복과 별도로 소모된다. */
export function updatePlayerMana(player, elapsedMs, { isDrawing = false, drawDrainMultiplier = 1 } = {}) {
  const elapsedUnits = Math.max(0, elapsedMs) / 100;
  const recovery = MANA_RECOVERY_PER_100_MS * elapsedUnits;
  const drawDrain = isDrawing
    ? MANA_DRAW_DRAIN_PER_100_MS * elapsedUnits * Math.max(0, Number(drawDrainMultiplier) || 0)
    : 0;
  player.mana = clamp(
    (player.mana ?? DEFAULT_MAXIMUM_MANA) + recovery - drawDrain,
    0,
    player.maximumMana ?? DEFAULT_MAXIMUM_MANA,
  );
  return player.mana;
}

export function shouldCancelRuneDrawing(player, isDrawing) {
  return Boolean(isDrawing && (player?.mana ?? 0) <= 0);
}

/** 실제로 적에게 들어간 피해의 30분의 1만큼 궁극기 게이지를 채운다. */
export function addUltimateFromDamage(player, inflictedDamage) {
  const gain = Math.max(0, Number(inflictedDamage) || 0) / 30;
  player.ultimate = clamp(
    (player.ultimate ?? 0) + gain,
    0,
    player.maximumUltimate ?? DEFAULT_MAXIMUM_ULTIMATE,
  );
  return player.ultimate;
}

export function updatePlayerCastCooldown(player, elapsedMs) {
  player.castCooldownMs = Math.max(0, (player.castCooldownMs ?? 0) - Math.max(0, elapsedMs));
  return player.castCooldownMs;
}

export function startPlayerCastCooldown(player) {
  player.castCooldownMs = MAGIC_CAST_COOLDOWN_MS;
  return player.castCooldownMs;
}

/** 사망 시 체력은 회복하고 보유 G와 궁극기 게이지는 초기화한다. */
export function resetPlayerAfterDeath(player) {
  player.health = player.maximumHealth ?? DEFAULT_MAXIMUM_HEALTH;
  player.gold = 0;
  player.ultimate = 0;
  player.castCooldownMs = 0;
  player.defenseBarrier = null;
  player.ultimateBuffMs = 0;
  return player;
}
