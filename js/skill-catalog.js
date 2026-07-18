export const ELEMENTS = Object.freeze([
  { id: "normal", label: "노말" },
  { id: "fire", label: "불" },
  { id: "water", label: "물" },
  { id: "grass", label: "풀" },
  { id: "ice", label: "얼음" },
  { id: "rock", label: "바위" },
  { id: "electric", label: "전기" },
  { id: "light", label: "빛" },
  { id: "dark", label: "어둠" },
]);

export const SkillType = Object.freeze({
  PROJECTILE: "A",
  AREA: "B",
  TARGET: "C",
});

export const SKILL_NAMES = Object.freeze({
  normal: Object.freeze(["마나볼", "트리플 볼", "하이퍼 볼"]),
  fire: Object.freeze(["파이어볼", "파이어 웨이브", "메테오"]),
  water: Object.freeze(["이슬비", "소나기", "파도의 부름"]),
  grass: Object.freeze(["나뭇잎 쏘기", "잎날 가르기", "가시덩쿨"]),
  rock: Object.freeze(["진동", "대지 균열", "대지진"]),
  electric: Object.freeze(["일렉트릭 샷", "크로스 볼트", "라이트닝 썬더"]),
  ice: Object.freeze(["아이스볼", "프리즈 스톰", "스노우 그레이브"]),
  light: Object.freeze(["섬광", "십자 광선", "스타 슬레이브"]),
  dark: Object.freeze(["그림자", "휘몰아치는 어둠", "시공간 붕괴"]),
});

export const ULTIMATE_SKILL_NAME = "신의 가호";

export function getSkillName(elementId, rank) {
  const normalizedRank = Math.max(1, Math.min(3, Number(rank) || 1));
  return SKILL_NAMES[elementId]?.[normalizedRank - 1] ?? `${elementId} ${normalizedRank}스킬`;
}

const DEFAULT_COMMON_SETTINGS = Object.freeze({
  attackPower: 100,
  castDelayMs: 500,
});

const DEFAULT_TYPE_SETTINGS = Object.freeze({
  [SkillType.PROJECTILE]: { projectileSpeed: 800, projectileSize: 24 },
  [SkillType.AREA]: { radius: 120, durationMs: 1000 },
  [SkillType.TARGET]: { targetRule: "nearest-on-camera" },
});

function createSkill(element, rank) {
  const type = [SkillType.PROJECTILE, SkillType.AREA, SkillType.TARGET][rank - 1];
  const id = `${element.id}-${rank}`;

  return {
    id,
    elementId: element.id,
    name: getSkillName(element.id, rank),
    rank,
    type,
    settings: {
      ...DEFAULT_COMMON_SETTINGS,
      ...DEFAULT_TYPE_SETTINGS[type],
    },
  };
}

/** 모든 속성의 1·2·3스킬을 같은 기본 수치로 만든다. */
export function createSkillCatalog() {
  return Object.fromEntries(
    ELEMENTS.flatMap((element) => [1, 2, 3].map((rank) => {
      const skill = createSkill(element, rank);
      return [skill.id, skill];
    })),
  );
}

/** 스킬 설정을 새 객체로 갱신한다. 원본 카탈로그는 변경하지 않는다. */
export function updateSkillSettings(catalog, skillId, settingsPatch) {
  const currentSkill = catalog[skillId];
  if (!currentSkill) {
    throw new Error(`스킬을 찾을 수 없습니다: ${skillId}`);
  }

  const nextSettings = { ...currentSkill.settings, ...settingsPatch };
  Object.entries(nextSettings).forEach(([key, value]) => {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${key} 값은 0 이상의 유한한 숫자여야 합니다.`);
    }
  });

  return {
    ...catalog,
    [skillId]: { ...currentSkill, settings: nextSettings },
  };
}
