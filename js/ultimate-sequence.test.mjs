import assert from "node:assert/strict";
import test from "node:test";
import {
  UltimatePhase,
  castUltimate,
  completeUltimateRune,
  createLightUltimateSequence,
  createUltimateSequence,
  getUltimateBuff,
  getUltimateTimeScale,
  LIGHT_ULTIMATE_RUNE_STROKES,
} from "./ultimate-sequence.js";

test("궁극기는 세 룬을 지정된 순서로 완료해야 중첩 문양 단계가 된다", () => {
  let sequence = createUltimateSequence({
    elementId: "fire",
    runeIds: ["fire-ultimate-1", "fire-ultimate-2", "fire-ultimate-3"],
    combinedSymbolId: "fire-ultimate-symbol",
  });

  sequence = completeUltimateRune(sequence, "wrong-rune");
  assert.equal(sequence.completedRuneCount, 0);

  sequence = completeUltimateRune(sequence, "fire-ultimate-1");
  sequence = completeUltimateRune(sequence, "fire-ultimate-2");
  sequence = completeUltimateRune(sequence, "fire-ultimate-3");

  assert.equal(sequence.phase, UltimatePhase.COMBINED_SYMBOL);
  assert.equal(sequence.completedRuneCount, 3);
});

test("궁극기 발현 시 시간 감속 없이 10초 공격·방어 장 강화를 얻는다", () => {
  let sequence = createUltimateSequence({
    elementId: "light",
    runeIds: ["light-ultimate-1", "light-ultimate-2", "light-ultimate-3"],
    combinedSymbolId: "light-ultimate-symbol",
  });

  sequence = completeUltimateRune(sequence, "light-ultimate-1");
  assert.deepEqual(getUltimateTimeScale(sequence), { enemySpeed: 0, manaDrain: 1 });
  sequence = completeUltimateRune(sequence, "light-ultimate-2");
  sequence = completeUltimateRune(sequence, "light-ultimate-3");
  sequence = castUltimate(sequence);

  assert.deepEqual(getUltimateTimeScale(sequence), { enemySpeed: 1, manaDrain: 1 });
  assert.deepEqual(getUltimateBuff(sequence), {
    durationMs: 10000,
    damageMultiplier: 1.5,
    incomingDamageMultiplier: 0.2,
    fieldDamage: 7.5,
    tickEveryMs: 100,
  });
});

test("빛 궁극기는 이중 원·사각 마름모·육각별의 세 독립 문양을 사용한다", () => {
  const sequence = createLightUltimateSequence();
  assert.equal(sequence.runeIds.length, 3);
  assert.equal(LIGHT_ULTIMATE_RUNE_STROKES.length, 3);
  assert.equal(LIGHT_ULTIMATE_RUNE_STROKES[0].length, 2);
  assert.equal(LIGHT_ULTIMATE_RUNE_STROKES[1].length, 2);
  assert.equal(LIGHT_ULTIMATE_RUNE_STROKES[2].length, 2);
  assert.ok(LIGHT_ULTIMATE_RUNE_STROKES[2].flat().every((point) => (
    point.x >= 0.26 && point.x <= 0.74 && point.y >= 0.27 && point.y <= 0.73
  )));
});
