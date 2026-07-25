import assert from "node:assert/strict";
import test from "node:test";
import { RUNE_CARDS, SECOND_SKILL_RUNE_POINTS, SECOND_SKILL_RUNE_STROKES, THIRD_SKILL_RUNE_POINTS, THIRD_SKILL_RUNE_STROKES, getRuneCard, getRunePoints, getRuneStrokes, scoreRuneTrace } from "./rune-card-catalog.js";

test("룬 카드는 지정된 순서의 9속성 1스킬로 구성된다", () => {
  assert.deepEqual(RUNE_CARDS.map((card) => card.label), ["노말", "바위", "물", "빛", "불", "전기", "어둠", "풀", "얼음"]);
});

test("제공된 참고 그림을 따라 모든 속성의 2스킬 룬 문양을 가진다", () => {
  assert.deepEqual(Object.keys(SECOND_SKILL_RUNE_POINTS).sort(), RUNE_CARDS.map((card) => card.id).sort());
  for (const card of RUNE_CARDS) assert.ok(getRunePoints(card, 2).length >= 7);
});

test("노말 2스킬은 중앙을 교차하는 뫼비우스 띠 모양이다", () => {
  const points = getRunePoints(getRuneCard("normal"), 2);
  assert.ok(Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y) < 0.000001);
  assert.ok(points.filter((point) => Math.abs(point.x - 0.5) < 0.001 && Math.abs(point.y - 0.5) < 0.001).length >= 3);
});

test("분리된 2스킬 도형은 보조 연결선 없이 각각 독립 획으로 저장된다", () => {
  assert.equal(SECOND_SKILL_RUNE_STROKES.fire.length, 2);
  assert.equal(SECOND_SKILL_RUNE_STROKES.rock.length, 2);
  assert.equal(SECOND_SKILL_RUNE_STROKES.light.length, 2);
  assert.equal(SECOND_SKILL_RUNE_STROKES.ice.length, 3);
  const fire = getRuneCard("fire");
  const trace = { strokes: getRuneStrokes(fire, 2).map((stroke) => stroke.map((point) => ({ ...point }))) };
  assert.ok(scoreRuneTrace(trace, fire, { left: 0, top: 0, width: 1, height: 1 }, 2) >= 95);
});

test("제공된 3스킬 참고 그림대로 모든 속성이 독립 획 룬 문양을 가진다", () => {
  assert.deepEqual(Object.keys(THIRD_SKILL_RUNE_POINTS).sort(), RUNE_CARDS.map((card) => card.id).sort());
  assert.equal(THIRD_SKILL_RUNE_STROKES.normal.length, 3);
  assert.equal(THIRD_SKILL_RUNE_STROKES.fire.length, 3);
  assert.equal(THIRD_SKILL_RUNE_STROKES.rock.length, 3);
  assert.equal(THIRD_SKILL_RUNE_STROKES.ice.length, 5);
  assert.equal(THIRD_SKILL_RUNE_STROKES.electric.length, 3);
  assert.equal(THIRD_SKILL_RUNE_STROKES.light.length, 2);
  assert.equal(THIRD_SKILL_RUNE_STROKES.dark.length, 2);
  for (const card of RUNE_CARDS) {
    const strokes = getRuneStrokes(card, 3);
    assert.ok(strokes.every((stroke) => stroke.length >= 2));
    const trace = { strokes: strokes.map((stroke) => stroke.map((point) => ({ ...point }))) };
    assert.ok(scoreRuneTrace(trace, card, { left: 0, top: 0, width: 1, height: 1 }, 3) >= 95);
  }
});

test("빛은 다섯 선 별, 전기는 Z, 풀은 M 문양을 사용한다", () => {
  const light = getRuneCard("light");
  const electric = getRuneCard("electric");
  const grass = getRuneCard("grass");
  assert.equal(light.points.length, 6);
  assert.deepEqual(light.points[0], light.points.at(-1));
  assert.deepEqual(electric.points, [
    { x: 0.18, y: 0.2 }, { x: 0.82, y: 0.2 }, { x: 0.18, y: 0.8 }, { x: 0.82, y: 0.8 },
  ]);
  assert.deepEqual(grass.points, [
    { x: 0.15, y: 0.82 }, { x: 0.15, y: 0.18 }, { x: 0.5, y: 0.62 }, { x: 0.85, y: 0.18 }, { x: 0.85, y: 0.82 },
  ]);
});

test("문양을 정확히 따라 그리면 높은 정확도를 얻는다", () => {
  const card = getRuneCard("fire");
  const trace = { strokes: [card.points.map((point) => ({ x: point.x, y: point.y }))] };
  assert.ok(scoreRuneTrace(trace, card, { left: 0, top: 0, width: 1, height: 1 }) >= 95);
});

test("문양에서 크게 벗어난 선은 낮은 정확도를 얻는다", () => {
  const card = getRuneCard("fire");
  const trace = { strokes: [[{ x: 0, y: 0 }, { x: 0.05, y: 0.05 }, { x: 0.1, y: 0.1 }, { x: 0.15, y: 0.15 }, { x: 0.2, y: 0.2 }]] };
  assert.ok(scoreRuneTrace(trace, card, { left: 0, top: 0, width: 1, height: 1 }) < 60);
});
