import { getElementMultiplier } from "./element-matchup.js";
import { ROOM_GRID_SIZE } from "./dungeon-generator.js";

export const MonsterSpawnClass = Object.freeze({
  MELEE: "melee",
  RANGED: "ranged",
  HYBRID: "hybrid",
  ELITE: "elite",
});

export const MONSTER_ATTACK_POWER_MULTIPLIER = 0.7;
export const MONSTER_MOVE_SPEED_MULTIPLIER = 2 / 3;

function reducedAttackPower(attack) {
  return Math.round(attack * MONSTER_ATTACK_POWER_MULTIPLIER * 10) / 10;
}

function reducedMoveSpeed(moveSpeed) {
  return Math.round(moveSpeed * MONSTER_MOVE_SPEED_MULTIPLIER * 1000) / 1000;
}

/**
 * 모든 전투 수치는 밸런스 확정 전 구조 검증용 임시값이다.
 * 이미지가 준비되면 assetKey에 대응하는 경로만 연결한다.
 */
export const MONSTER_CATALOG = Object.freeze({
  slime: { name: "슬라임", chapter: 1, spawnClass: "melee", attackStyle: "melee", unitValue: 1, elements: ["normal", "fire", "water", "grass"], stats: { health: 80, attack: 12, size: 0.82, attackRange: 1.1, moveSpeed: 1.8 }, assetKey: "monster.slime", valuesAreTemporary: true },
  bigSlime: { name: "빅 슬라임", chapter: 1, spawnClass: "elite", attackStyle: "melee", unitValue: 2, elements: ["normal", "fire", "water", "grass"], stats: { health: 180, attack: 22, size: 1.28, attackRange: 1.4, moveSpeed: 1.2 }, assetKey: "monster.big-slime", valuesAreTemporary: true },
  warriorSpirit: { name: "전사 정령", chapter: 1, spawnClass: "melee", attackStyle: "melee", unitValue: 1, elements: ["normal", "fire", "water", "grass"], stats: { health: 110, attack: 16, size: 1, attackRange: 1.25, moveSpeed: 1.6 }, assetKey: "monster.warrior-spirit", valuesAreTemporary: true },
  mageSpirit: { name: "마법사 정령", chapter: 1, spawnClass: "ranged", attackStyle: "ranged", unitValue: 1, elements: ["normal", "fire", "water", "grass"], stats: { health: 72, attack: 15, size: 0.95, attackRange: 5.4, moveSpeed: 1.25 }, assetKey: "monster.mage-spirit", valuesAreTemporary: true },
  fairy: { name: "요정", chapter: 1, spawnClass: "ranged", attackStyle: "ranged", unitValue: 1, elements: ["normal", "fire", "water", "grass"], stats: { health: 48, attack: 9, size: 0.58, attackRange: 4.6, moveSpeed: 2.9 }, assetKey: "monster.fairy", valuesAreTemporary: true },
  miniGolem: { name: "미니 골렘", chapter: 2, spawnClass: "melee", attackStyle: "melee", unitValue: 1, elements: ["rock", "ice", "electric"], stats: { health: 140, attack: 18, size: 1, attackRange: 1.2, moveSpeed: 1.25 }, assetKey: "monster.mini-golem", valuesAreTemporary: true },
  golem: { name: "골렘", chapter: 2, spawnClass: "elite", attackStyle: "melee", unitValue: 2, elements: ["rock", "ice", "electric"], stats: { health: 320, attack: 34, size: 1.55, attackRange: 1.7, moveSpeed: 0.72 }, assetKey: "monster.golem", valuesAreTemporary: true },
  electricSnake: { name: "전기뱀", chapter: 2, spawnClass: "hybrid", attackStyle: "hybrid", unitValue: 1, elements: ["electric"], stats: { health: 105, attack: 20, size: 0.85, attackRange: 4.2, moveSpeed: 1.9 }, assetKey: "monster.electric-snake", valuesAreTemporary: true },
  iceBat: { name: "얼음 박쥐", chapter: 2, spawnClass: "hybrid", attackStyle: "hybrid", unitValue: 1, elements: ["ice"], stats: { health: 78, attack: 17, size: 0.7, attackRange: 4.5, moveSpeed: 2.2 }, assetKey: "monster.ice-bat", valuesAreTemporary: true },
  darkKnight: { name: "흑기사", chapter: 3, spawnClass: "melee", attackStyle: "melee", unitValue: 1, elements: ["dark"], stats: { health: 175, attack: 28, size: 1.08, attackRange: 1.35, moveSpeed: 1.55 }, assetKey: "monster.dark-knight", valuesAreTemporary: true },
  darkMage: { name: "흑마법사", chapter: 3, spawnClass: "ranged", attackStyle: "ranged", unitValue: 1, elements: ["dark"], stats: { health: 110, attack: 25, size: 0.98, attackRange: 5.8, moveSpeed: 1.3 }, assetKey: "monster.dark-mage", valuesAreTemporary: true },
  imp: { name: "소악마", chapter: 3, spawnClass: "hybrid", attackStyle: "hybrid", unitValue: 1, elements: ["dark"], stats: { health: 120, attack: 22, size: 0.82, attackRange: 4.4, moveSpeed: 2 }, assetKey: "monster.imp", valuesAreTemporary: true },
  demon: { name: "악마", chapter: 3, spawnClass: "elite", attackStyle: "hybrid", unitValue: 2, elements: ["dark"], stats: { health: 290, attack: 36, size: 1.42, attackRange: 4.8, moveSpeed: 1.45 }, assetKey: "monster.demon", valuesAreTemporary: true },
});

function pickRandom(items, random) {
  return items[Math.floor(random() * items.length)];
}

export function getMonsterTemplates({ chapter, spawnClass = null }) {
  return Object.entries(MONSTER_CATALOG)
    .filter(([, template]) => template.chapter === chapter && (!spawnClass || template.spawnClass === spawnClass))
    .map(([templateId, template]) => ({ templateId, ...template }));
}

export function createMonsterInstance(template, { random = Math.random, instanceIndex = 0, position = null } = {}) {
  const stats = {
    ...template.stats,
    attack: reducedAttackPower(template.stats.attack),
    moveSpeed: reducedMoveSpeed(template.stats.moveSpeed)
      * (template.templateId === "warriorSpirit" ? 1.5 : 1),
  };
  const isFairy = template.templateId === "fairy";
  const isSlime = template.templateId === "slime" || template.templateId === "bigSlime";
  const spawnPosition = position ?? { x: 0.5, z: 0.5 };
  return {
    id: `${template.templateId}-${instanceIndex}`,
    templateId: template.templateId,
    name: template.name,
    spawnClass: template.spawnClass,
    attackStyle: template.attackStyle,
    unitValue: template.unitValue,
    element: pickRandom(template.elements, random),
    stats,
    currentHealth: stats.health,
    maximumHealth: stats.health,
    rangedCooldownMs: 900 + instanceIndex * 180,
    attackCooldownMs: 450 + instanceIndex * 120,
    aiState: "idle",
    stateTimeMs: 0,
    pendingAttackType: null,
    attackYaw: 0,
    hitboxScale: isFairy ? 0.52 : 1,
    airborneHeight: isFairy ? 0.55 : 0,
    movementStyle: isSlime ? "hop" : "walk",
    hopPhase: instanceIndex * 0.9,
    slimeHopState: isSlime ? "waiting" : null,
    slimeHopTimerMs: isSlime ? 300 : 0,
    slimeHopProgress: 0,
    contactHitThisHop: false,
    footstepTimerMs: 0,
    hitFlashMs: 0,
    hasDetectedPlayer: false,
    detectionAlertMs: 0,
    assetKey: template.assetKey,
    valuesAreTemporary: true,
    position: { ...spawnPosition, y: isFairy ? 0.55 : 0 },
  };
}

/** 전투 노드 단계가 오를 때마다 일반 적의 체력과 공격력을 1.2배 누적한다. */
export function scaleMonsterForStage(monster, stage = 1) {
  const multiplier = 1.2 ** Math.max(0, Number(stage) - 1);
  monster.stats.health = Math.round(monster.stats.health * multiplier);
  monster.stats.attack = Math.round(monster.stats.attack * multiplier * 10) / 10;
  monster.maximumHealth = monster.stats.health;
  monster.currentHealth = monster.stats.health;
  monster.stageMultiplier = multiplier;
  return monster;
}

export function createSpiritKingBoss({ position = { x: 0, z: 0 } } = {}) {
  return {
    id: "spirit-king",
    templateId: "spiritKing",
    name: "타락한 정령왕",
    spawnClass: "boss",
    attackStyle: "boss",
    unitValue: 10,
    element: "dark",
    stats: { health: 4000, attack: reducedAttackPower(36), size: 3.15, attackRange: 2.4, moveSpeed: reducedMoveSpeed(1.05) },
    currentHealth: 4000,
    maximumHealth: 4000,
    rangedCooldownMs: 1800,
    attackCooldownMs: 1200,
    aiState: "idle",
    stateTimeMs: 0,
    pendingAttackType: null,
    attackYaw: 0,
    hitboxScale: 1.15,
    airborneHeight: 0,
    movementStyle: "walk",
    footstepTimerMs: 0,
    hitFlashMs: 0,
    assetKey: "monster.spirit-king",
    isBoss: true,
    bossPauseCycleMs: 15000,
    bossPausedMs: 0,
    bossDarkCooldownMs: 10000,
    phaseTwoSoundPlayed: false,
    bossActionPrepareMs: 0,
    bossPendingAction: null,
    position: { ...position, y: 0 },
  };
}

function createAvailableGridCells(blockedPositions = []) {
  const cells = [];
  const halfGrid = Math.floor(ROOM_GRID_SIZE / 2);
  for (let row = 0; row < ROOM_GRID_SIZE; row += 1) {
    for (let column = 0; column < ROOM_GRID_SIZE; column += 1) {
      const cell = { x: column - halfGrid, z: row - halfGrid };
      const nearCenter = Math.abs(cell.x) <= 1 && Math.abs(cell.z) <= 1;
      const blocked = blockedPositions.some((position) => (
        Math.hypot(position.x - cell.x, position.z - cell.z) < 0.8
      ));
      if (!nearCenter && !blocked) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

function isInsideDoorSpawnExclusion(cell, doorDirections = []) {
  const halfGrid = Math.floor(ROOM_GRID_SIZE / 2);
  return doorDirections.some((direction) => {
    if (direction === "north") return cell.z <= -halfGrid + 2 && Math.abs(cell.x) <= 1;
    if (direction === "south") return cell.z >= halfGrid - 2 && Math.abs(cell.x) <= 1;
    if (direction === "west") return cell.x <= -halfGrid + 2 && Math.abs(cell.z) <= 1;
    if (direction === "east") return cell.x >= halfGrid - 2 && Math.abs(cell.z) <= 1;
    return false;
  });
}

/** 한 방에 실제 개체 3~5마리를 만들고 각 개체를 비어 있는 격자 칸에 배치한다. */
export function generateRoomMonsters({
  chapter = 1,
  random = Math.random,
  minimumCount = 3,
  maximumCount = 5,
  blockedPositions = [],
  doorDirections = [],
} = {}) {
  if (minimumCount < 0 || maximumCount < minimumCount) {
    throw new Error("몬스터 개체 수 범위가 올바르지 않습니다.");
  }
  const monsterCount = minimumCount + Math.floor(random() * (maximumCount - minimumCount + 1));
  const candidates = getMonsterTemplates({ chapter });
  const availableCells = createAvailableGridCells(blockedPositions);
  const monsters = [];

  while (monsters.length < monsterCount && availableCells.length > 0) {
    const spawnClasses = [...new Set(candidates.map((template) => template.spawnClass))];
    const chosenClass = pickRandom(spawnClasses, random);
    const template = pickRandom(candidates.filter((candidate) => candidate.spawnClass === chosenClass), random);
    const isSlime = template.templateId === "slime" || template.templateId === "bigSlime";
    const validCellIndices = availableCells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => !isSlime || !isInsideDoorSpawnExclusion(cell, doorDirections))
      .map(({ index }) => index);
    if (validCellIndices.length === 0) continue;
    const cellIndex = validCellIndices[Math.floor(random() * validCellIndices.length)];
    const [position] = availableCells.splice(cellIndex, 1);
    monsters.push(createMonsterInstance(template, { random, instanceIndex: monsters.length, position }));
  }

  return {
    count: monsters.length,
    budget: monsters.reduce((total, monster) => total + monster.unitValue, 0),
    monsters,
  };
}

export function calculateMonsterAttackDamage(monster, defenderElement) {
  return monster.stats.attack * getElementMultiplier(monster.element, defenderElement);
}
