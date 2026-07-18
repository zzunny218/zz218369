function circlePoints(count = 36) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / count;
    return { x: 0.5 + Math.cos(angle) * 0.34, y: 0.5 + Math.sin(angle) * 0.34 };
  });
}

function pentagramPoints() {
  const vertices = Array.from({ length: 5 }, (_, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / 5;
    return { x: 0.5 + Math.cos(angle) * 0.38, y: 0.5 + Math.sin(angle) * 0.38 };
  });
  return [vertices[0], vertices[2], vertices[4], vertices[1], vertices[3], vertices[0]];
}

function spiralPoints(count = 38) {
  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    const angle = progress * Math.PI * 4.2;
    const radius = 0.04 + progress * 0.34;
    return { x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius };
  });
}

function mobiusPoints(count = 48) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = Math.PI * 2 * index / count;
    return {
      x: 0.5 + Math.sin(angle) * 0.4,
      y: 0.5 + Math.sin(angle * 2) * 0.22,
    };
  });
}

function ellipsePoints(centerX, centerY, radiusX, radiusY, count = 32) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / count;
    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  });
}

function eyeOutlinePoints(count = 32) {
  const upper = Array.from({ length: count / 2 + 1 }, (_, index) => {
    const amount = index / (count / 2);
    return { x: 0.08 + amount * 0.84, y: 0.5 - Math.sin(amount * Math.PI) * 0.24 };
  });
  const lower = Array.from({ length: count / 2 + 1 }, (_, index) => {
    const amount = index / (count / 2);
    return { x: 0.92 - amount * 0.84, y: 0.5 + Math.sin(amount * Math.PI) * 0.24 };
  });
  return [...upper, ...lower.slice(1)];
}

/** 사용자가 제공한 2스킬 룬 참고 그림을 게임 좌표로 옮긴 문양이다. */
export const SECOND_SKILL_RUNE_STROKES = Object.freeze({
  normal: [mobiusPoints()],
  fire: [
    [{ x: 0.5, y: 0.08 }, { x: 0.9, y: 0.84 }, { x: 0.1, y: 0.84 }, { x: 0.5, y: 0.08 }],
    [{ x: 0.5, y: 0.33 }, { x: 0.67, y: 0.65 }, { x: 0.33, y: 0.65 }, { x: 0.5, y: 0.33 }],
  ],
  water: [
    [{ x: 0.5, y: 0.08 }, { x: 0.28, y: 0.48 }, { x: 0.25, y: 0.68 }, { x: 0.36, y: 0.86 }, { x: 0.5, y: 0.92 }, { x: 0.64, y: 0.86 }, { x: 0.75, y: 0.68 }, { x: 0.72, y: 0.48 }, { x: 0.5, y: 0.08 }],
    [{ x: 0.18, y: 0.42 }, { x: 0.1, y: 0.58 }, { x: 0.16, y: 0.76 }, { x: 0.32, y: 0.88 }, { x: 0.5, y: 0.92 }, { x: 0.68, y: 0.88 }, { x: 0.84, y: 0.76 }, { x: 0.9, y: 0.58 }, { x: 0.82, y: 0.42 }],
  ],
  grass: [[{ x: 0.08, y: 0.82 }, { x: 0.22, y: 0.14 }, { x: 0.38, y: 0.62 }, { x: 0.5, y: 0.16 }, { x: 0.62, y: 0.62 }, { x: 0.78, y: 0.14 }, { x: 0.92, y: 0.82 }]],
  electric: [[{ x: 0.14, y: 0.2 }, { x: 0.78, y: 0.12 }, { x: 0.38, y: 0.38 }, { x: 0.82, y: 0.34 }, { x: 0.3, y: 0.62 }, { x: 0.76, y: 0.58 }, { x: 0.16, y: 0.9 }]],
  rock: [
    [{ x: 0.22, y: 0.22 }, { x: 0.78, y: 0.22 }, { x: 0.78, y: 0.78 }, { x: 0.22, y: 0.78 }, { x: 0.22, y: 0.22 }],
    [{ x: 0.5, y: 0.1 }, { x: 0.9, y: 0.5 }, { x: 0.5, y: 0.9 }, { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.1 }],
  ],
  ice: [
    [{ x: 0.5, y: 0.92 }, { x: 0.5, y: 0.1 }],
    [{ x: 0.18, y: 0.44 }, { x: 0.5, y: 0.18 }, { x: 0.82, y: 0.44 }],
    [{ x: 0.28, y: 0.58 }, { x: 0.5, y: 0.38 }, { x: 0.72, y: 0.58 }],
  ],
  light: [
    [{ x: 0.5, y: 0.08 }, { x: 0.88, y: 0.72 }, { x: 0.12, y: 0.72 }, { x: 0.5, y: 0.08 }],
    [{ x: 0.12, y: 0.32 }, { x: 0.88, y: 0.32 }, { x: 0.5, y: 0.92 }, { x: 0.12, y: 0.32 }],
  ],
  dark: [[{ x: 0.31, y: 0.2 }, { x: 0.2, y: 0.16 }, { x: 0.13, y: 0.23 }, { x: 0.16, y: 0.33 }, { x: 0.27, y: 0.35 }, { x: 0.38, y: 0.28 }, { x: 0.31, y: 0.2 }, { x: 0.48, y: 0.18 }, { x: 0.66, y: 0.22 }, { x: 0.76, y: 0.34 }, { x: 0.72, y: 0.46 }, { x: 0.58, y: 0.54 }, { x: 0.42, y: 0.58 }, { x: 0.28, y: 0.67 }, { x: 0.24, y: 0.79 }, { x: 0.34, y: 0.88 }, { x: 0.52, y: 0.9 }, { x: 0.69, y: 0.82 }, { x: 0.76, y: 0.7 }, { x: 0.69, y: 0.64 }, { x: 0.58, y: 0.68 }, { x: 0.55, y: 0.78 }, { x: 0.63, y: 0.84 }, { x: 0.74, y: 0.8 }]],
});

export const SECOND_SKILL_RUNE_POINTS = Object.freeze(Object.fromEntries(
  Object.entries(SECOND_SKILL_RUNE_STROKES).map(([element, strokes]) => [element, strokes.flat()]),
));

/** 사용자가 제공한 3스킬 도안을 서로 독립적인 실제 획만으로 정리한 룬 문양이다. */
export const THIRD_SKILL_RUNE_STROKES = Object.freeze({
  normal: [
    ellipsePoints(0.5, 0.27, 0.18, 0.2, 24),
    ellipsePoints(0.3, 0.65, 0.18, 0.2, 24),
    ellipsePoints(0.7, 0.65, 0.18, 0.2, 24),
  ],
  fire: [
    [{ x: 0.5, y: 0.07 }, { x: 0.94, y: 0.88 }, { x: 0.06, y: 0.88 }, { x: 0.5, y: 0.07 }],
    [{ x: 0.5, y: 0.29 }, { x: 0.76, y: 0.72 }, { x: 0.24, y: 0.72 }, { x: 0.5, y: 0.29 }],
    [{ x: 0.37, y: 0.47 }, { x: 0.63, y: 0.47 }, { x: 0.5, y: 0.67 }, { x: 0.37, y: 0.47 }],
  ],
  water: [
    [{ x: 0.5, y: 0.06 }, { x: 0.27, y: 0.3 }, { x: 0.18, y: 0.58 }, { x: 0.24, y: 0.81 }, { x: 0.5, y: 0.94 }, { x: 0.76, y: 0.81 }, { x: 0.82, y: 0.58 }, { x: 0.73, y: 0.3 }, { x: 0.5, y: 0.06 }],
    [{ x: 0.5, y: 0.26 }, { x: 0.37, y: 0.48 }, { x: 0.35, y: 0.65 }, { x: 0.5, y: 0.76 }, { x: 0.65, y: 0.65 }, { x: 0.63, y: 0.48 }, { x: 0.5, y: 0.26 }],
  ],
  grass: [
    [{ x: 0.5, y: 0.1 }, { x: 0.7, y: 0.4 }, { x: 0.5, y: 0.7 }, { x: 0.3, y: 0.4 }, { x: 0.5, y: 0.1 }],
    [{ x: 0.07, y: 0.9 }, { x: 0.22, y: 0.64 }, { x: 0.37, y: 0.9 }],
    [{ x: 0.63, y: 0.9 }, { x: 0.78, y: 0.64 }, { x: 0.93, y: 0.9 }],
  ],
  rock: [
    [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }, { x: 0.2, y: 0.2 }],
    [{ x: 0.5, y: 0.06 }, { x: 0.94, y: 0.5 }, { x: 0.5, y: 0.94 }, { x: 0.06, y: 0.5 }, { x: 0.5, y: 0.06 }],
    [{ x: 0.37, y: 0.37 }, { x: 0.63, y: 0.37 }, { x: 0.63, y: 0.63 }, { x: 0.37, y: 0.63 }, { x: 0.37, y: 0.37 }],
  ],
  ice: [
    [{ x: 0.5, y: 0.92 }, { x: 0.5, y: 0.08 }],
    [{ x: 0.24, y: 0.34 }, { x: 0.5, y: 0.08 }, { x: 0.76, y: 0.34 }],
    [{ x: 0.34, y: 0.4 }, { x: 0.5, y: 0.24 }, { x: 0.66, y: 0.4 }],
    [{ x: 0.24, y: 0.66 }, { x: 0.5, y: 0.92 }, { x: 0.76, y: 0.66 }],
    [{ x: 0.34, y: 0.6 }, { x: 0.5, y: 0.76 }, { x: 0.66, y: 0.6 }],
  ],
  electric: [
    [{ x: 0.08, y: 0.18 }, { x: 0.34, y: 0.18 }, { x: 0.12, y: 0.82 }, { x: 0.38, y: 0.82 }],
    [{ x: 0.37, y: 0.18 }, { x: 0.63, y: 0.18 }, { x: 0.41, y: 0.82 }, { x: 0.67, y: 0.82 }],
    [{ x: 0.66, y: 0.18 }, { x: 0.92, y: 0.18 }, { x: 0.7, y: 0.82 }, { x: 0.96, y: 0.82 }],
  ],
  light: [
    [{ x: 0.5, y: 0.04 }, { x: 0.58, y: 0.42 }, { x: 0.96, y: 0.5 }, { x: 0.58, y: 0.58 }, { x: 0.5, y: 0.96 }, { x: 0.42, y: 0.58 }, { x: 0.04, y: 0.5 }, { x: 0.42, y: 0.42 }, { x: 0.5, y: 0.04 }],
    [{ x: 0.16, y: 0.16 }, { x: 0.5, y: 0.42 }, { x: 0.84, y: 0.16 }, { x: 0.58, y: 0.5 }, { x: 0.84, y: 0.84 }, { x: 0.5, y: 0.58 }, { x: 0.16, y: 0.84 }, { x: 0.42, y: 0.5 }, { x: 0.16, y: 0.16 }],
  ],
  dark: [eyeOutlinePoints(), spiralPoints(34).map((point) => ({
    x: 0.5 + (point.x - 0.5) * 0.58,
    y: 0.5 + (point.y - 0.5) * 0.58,
  }))],
});

export const THIRD_SKILL_RUNE_POINTS = Object.freeze(Object.fromEntries(
  Object.entries(THIRD_SKILL_RUNE_STROKES).map(([element, strokes]) => [element, strokes.flat()]),
));

export const RUNE_CARDS = Object.freeze([
  { id: "normal", label: "노말", color: "#d7e4ee", points: circlePoints() },
  { id: "rock", label: "바위", color: "#c28762", points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }, { x: 0.2, y: 0.2 }] },
  { id: "water", label: "물", color: "#4f7dff", points: [{ x: 0.5, y: 0.1 }, { x: 0.72, y: 0.45 }, { x: 0.76, y: 0.65 }, { x: 0.66, y: 0.82 }, { x: 0.5, y: 0.9 }, { x: 0.34, y: 0.82 }, { x: 0.24, y: 0.65 }, { x: 0.28, y: 0.45 }, { x: 0.5, y: 0.1 }] },
  { id: "light", label: "빛", color: "#fff2a2", points: pentagramPoints() },
  { id: "fire", label: "불", color: "#ff5b52", points: [{ x: 0.5, y: 0.12 }, { x: 0.84, y: 0.82 }, { x: 0.16, y: 0.82 }, { x: 0.5, y: 0.12 }] },
  { id: "electric", label: "전기", color: "#ffd62e", points: [{ x: 0.18, y: 0.2 }, { x: 0.82, y: 0.2 }, { x: 0.18, y: 0.8 }, { x: 0.82, y: 0.8 }] },
  { id: "dark", label: "어둠", color: "#a27cff", points: spiralPoints() },
  { id: "grass", label: "풀", color: "#45dc77", points: [{ x: 0.15, y: 0.82 }, { x: 0.15, y: 0.18 }, { x: 0.5, y: 0.62 }, { x: 0.85, y: 0.18 }, { x: 0.85, y: 0.82 }] },
  { id: "ice", label: "얼음", color: "#4dbcf7", points: [{ x: 0.5, y: 0.9 }, { x: 0.5, y: 0.12 }, { x: 0.27, y: 0.42 }, { x: 0.5, y: 0.12 }, { x: 0.73, y: 0.42 }] },
]);

export function getRuneCard(cardId) {
  return RUNE_CARDS.find((card) => card.id === cardId) ?? null;
}

export function getRuneStrokes(card, skillTier = 1) {
  if (!card) return [];
  if (Array.isArray(card.ultimateStrokes)) return card.ultimateStrokes;
  if (skillTier === 3) return THIRD_SKILL_RUNE_STROKES[card.id] ?? [card.points ?? []];
  if (skillTier === 2) return SECOND_SKILL_RUNE_STROKES[card.id] ?? [card.points ?? []];
  return [card.points ?? []];
}

export function getRunePoints(card, skillTier = 1) {
  return getRuneStrokes(card, skillTier).flat();
}

export function getRuneSvgPoints(card, skillTier = 1) {
  return getRunePoints(card, skillTier).map((point) => `${point.x * 100},${point.y * 100}`).join(" ");
}

export function getRuneSvgPolylines(card, skillTier = 1) {
  return getRuneStrokes(card, skillTier)
    .map((stroke) => stroke.map((point) => `${point.x * 100},${point.y * 100}`).join(" "));
}

function pointToSegmentDistance(point, start, end) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX ** 2 + segmentY ** 2;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const amount = Math.min(1, Math.max(0, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared));
  return Math.hypot(point.x - (start.x + segmentX * amount), point.y - (start.y + segmentY * amount));
}

function distanceToPolylines(point, polylines) {
  let minimum = Number.POSITIVE_INFINITY;
  for (const line of polylines) {
    for (let index = 1; index < line.length; index += 1) {
      minimum = Math.min(minimum, pointToSegmentDistance(point, line[index - 1], line[index]));
    }
  }
  return minimum;
}

function densify(points, spacing = 0.025) {
  const result = [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / spacing));
    for (let step = 0; step < steps; step += 1) {
      const amount = step / steps;
      result.push({ x: start.x + (end.x - start.x) * amount, y: start.y + (end.y - start.y) * amount });
    }
  }
  result.push(points.at(-1));
  return result;
}

/** 전체 화면 정규화 좌표를 중앙 문양 영역으로 변환해 선 정밀도와 문양 커버리지를 함께 채점한다. */
export function scoreRuneTrace(trace, card, targetBounds, skillTier = 1) {
  const drawnLines = trace.strokes
    .filter((stroke) => stroke.length >= 2)
    .map((stroke) => stroke.map((point) => ({
      x: (point.x - targetBounds.left) / targetBounds.width,
      y: (point.y - targetBounds.top) / targetBounds.height,
    })));
  const pointCount = drawnLines.reduce((total, line) => total + line.length, 0);
  if (pointCount < 4 || !card) return 0;

  const denseDrawn = drawnLines.flatMap((line) => densify(line));
  const templateLines = getRuneStrokes(card, skillTier).filter((stroke) => stroke.length >= 2);
  const denseTemplate = templateLines.flatMap((line) => densify(line));
  const precision = denseDrawn.reduce((total, point) => total + distanceToPolylines(point, templateLines), 0) / denseDrawn.length;
  const coverage = denseTemplate.reduce((total, point) => total + distanceToPolylines(point, drawnLines), 0) / denseTemplate.length;
  const outsidePenalty = denseDrawn.filter((point) => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1).length / denseDrawn.length * 0.12;
  const error = (precision + coverage) / 2 + outsidePenalty;
  return Math.round(Math.max(0, Math.min(100, (1 - error / 0.28) * 100)));
}
