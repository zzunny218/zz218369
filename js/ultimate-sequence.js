export const UltimatePhase = Object.freeze({
  RUNE_ONE: "rune-one",
  RUNE_TWO: "rune-two",
  RUNE_THREE: "rune-three",
  COMBINED_SYMBOL: "combined-symbol",
  CASTED: "casted",
});

function ellipsePoints(centerX, centerY, radiusX, radiusY, count = 36, gap = 0.08) {
  return Array.from({ length: count }, (_, index) => {
    const angle = gap + index / (count - 1) * (Math.PI * 2 - gap * 2);
    return { x: centerX + Math.cos(angle) * radiusX, y: centerY + Math.sin(angle) * radiusY };
  });
}

/** 사용자가 제공한 빛 궁극기 도안: 이중 원, 정사각형+마름모, 육각별 순서다. */
export const LIGHT_ULTIMATE_RUNE_STROKES = Object.freeze([
  [
    ellipsePoints(0.5, 0.5, 0.39, 0.39, 42, 0.18),
    ellipsePoints(0.5, 0.5, 0.27, 0.27, 36, 0.22),
  ],
  [
    [{ x: 0.18, y: 0.2 }, { x: 0.82, y: 0.2 }, { x: 0.82, y: 0.8 }, { x: 0.18, y: 0.8 }, { x: 0.18, y: 0.2 }],
    [{ x: 0.5, y: 0.08 }, { x: 0.92, y: 0.5 }, { x: 0.5, y: 0.92 }, { x: 0.08, y: 0.5 }, { x: 0.5, y: 0.08 }],
  ],
  [
    [{ x: 0.5, y: 0.27 }, { x: 0.74, y: 0.68 }, { x: 0.26, y: 0.68 }, { x: 0.5, y: 0.27 }],
    [{ x: 0.26, y: 0.36 }, { x: 0.74, y: 0.36 }, { x: 0.5, y: 0.73 }, { x: 0.26, y: 0.36 }],
  ],
]);

export const LIGHT_ULTIMATE_RUNE_IDS = Object.freeze([
  "light-ultimate-circle",
  "light-ultimate-square",
  "light-ultimate-star",
]);

export function createLightUltimateSequence() {
  return createUltimateSequence({
    elementId: "light",
    runeIds: LIGHT_ULTIMATE_RUNE_IDS,
    combinedSymbolId: "light-ultimate-combined",
  });
}

/** 속성 궁극기의 3룬 순서와 마지막 중첩 문양을 관리한다. */
export function createUltimateSequence({ elementId, runeIds, combinedSymbolId }) {
  if (runeIds.length !== 3) {
    throw new Error("궁극기는 순서대로 그릴 룬 3개가 필요합니다.");
  }

  return {
    elementId,
    runeIds: [...runeIds],
    combinedSymbolId,
    completedRuneCount: 0,
    phase: UltimatePhase.RUNE_ONE,
  };
}

/** 올바른 룬 하나가 완성되었을 때 궁극기 연출 단계를 진행한다. */
export function completeUltimateRune(sequence, completedRuneId) {
  const expectedRuneId = sequence.runeIds[sequence.completedRuneCount];

  if (sequence.phase === UltimatePhase.COMBINED_SYMBOL || sequence.phase === UltimatePhase.CASTED) {
    return sequence;
  }

  if (completedRuneId !== expectedRuneId) {
    return sequence;
  }

  const completedRuneCount = sequence.completedRuneCount + 1;
  const phase = [UltimatePhase.RUNE_ONE, UltimatePhase.RUNE_TWO, UltimatePhase.RUNE_THREE][completedRuneCount]
    ?? UltimatePhase.COMBINED_SYMBOL;

  return { ...sequence, completedRuneCount, phase };
}

/** 세 룬 중첩 및 최종 문양 연출이 끝나면 궁극기를 발현한다. */
export function castUltimate(sequence) {
  if (sequence.phase !== UltimatePhase.COMBINED_SYMBOL) {
    return sequence;
  }

  return { ...sequence, phase: UltimatePhase.CASTED };
}

/** 최신 궁극기는 시간 감속 없이 공격·방어 장 강화 효과를 사용한다. */
export function getUltimateTimeScale(sequence) {
  const isDrawing = sequence?.phase !== UltimatePhase.CASTED;
  return { enemySpeed: isDrawing ? 0 : 1, manaDrain: 1 };
}

export function getUltimateBuff(sequence) {
  if (sequence.phase !== UltimatePhase.CASTED) return null;
  return { durationMs: 10000, damageMultiplier: 1.5, incomingDamageMultiplier: 0.2, fieldDamage: 7.5, tickEveryMs: 100 };
}
