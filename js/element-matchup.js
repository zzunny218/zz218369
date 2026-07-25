export const ElementId = Object.freeze({
  NORMAL: "normal",
  FIRE: "fire",
  WATER: "water",
  GRASS: "grass",
  ICE: "ice",
  ROCK: "rock",
  ELECTRIC: "electric",
  LIGHT: "light",
  DARK: "dark",
});

const ADVANTAGE = Object.freeze({
  fire: new Set(["grass", "ice"]),
  water: new Set(["fire", "electric"]),
  grass: new Set(["water", "rock", "electric"]),
  ice: new Set(["grass", "water", "electric"]),
  rock: new Set(["fire", "ice", "electric"]),
  electric: new Set(["fire"]),
  light: new Set(["fire", "water", "grass", "ice", "rock", "electric", "light", "dark"]),
  dark: new Set(["fire", "water", "grass", "ice", "rock", "electric", "dark"]),
});

const DISADVANTAGE = Object.freeze({
  fire: new Set(["water", "rock", "electric", "light", "dark"]),
  water: new Set(["grass", "ice", "light", "dark"]),
  grass: new Set(["fire", "ice", "light", "dark"]),
  ice: new Set(["fire", "rock", "light", "dark"]),
  rock: new Set(["water", "grass", "light", "dark"]),
  electric: new Set(["water", "grass", "ice", "rock", "light", "dark"]),
  light: new Set(),
  dark: new Set(["light"]),
});

export function getElementRelation(attackerElement, defenderElement) {
  if (attackerElement === ElementId.NORMAL || defenderElement === ElementId.NORMAL) {
    return "neutral";
  }
  if (ADVANTAGE[attackerElement]?.has(defenderElement)) {
    return "advantage";
  }
  if (DISADVANTAGE[attackerElement]?.has(defenderElement)) {
    return "disadvantage";
  }
  return "neutral";
}

export function getElementMultiplier(attackerElement, defenderElement) {
  const relation = getElementRelation(attackerElement, defenderElement);
  return relation === "advantage" ? 1.25 : relation === "disadvantage" ? 0.8 : 1;
}
