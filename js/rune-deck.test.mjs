import assert from "node:assert/strict";
import test from "node:test";
import { RUNE_CARDS } from "./rune-card-catalog.js";
import { addSecondSkillCardsToWarehouse, addThirdSkillCardsToWarehouse, createRuneCardPool, createRuneDeck, refreshRuneHand, rotateUsedRuneCard } from "./rune-deck.js";

test("처음에는 9장 중 무작위 8장이 한 번에 나오고 나머지는 창고에 보관된다", () => {
  const deck = createRuneDeck(RUNE_CARDS, { random: () => 0 });
  assert.equal(deck.hand.length, 8);
  assert.equal(deck.warehouse.length, 1);
  assert.equal(new Set([...deck.hand, ...deck.warehouse].map((card) => card.id)).size, 9);
});

test("3스킬 구매 시 같은 속성 카드 한 장이 창고에 추가된다", () => {
  const deck = createRuneDeck(createRuneCardPool(RUNE_CARDS), { random: () => 0 });
  const fireCard = RUNE_CARDS.find((card) => card.id === "fire");
  const added = addThirdSkillCardsToWarehouse(deck, fireCard);
  assert.equal(added.length, 1);
  assert.ok(added.every((card) => card.skillTier === 3));
});

test("사용한 카드는 창고로 가고 새 카드는 손패의 가장 오른쪽에 쌓인다", () => {
  const deck = createRuneDeck(RUNE_CARDS, { random: () => 0 });
  const usedCard = deck.hand[2];
  const previousWarehouseIds = new Set(deck.warehouse.map((card) => card.id));
  const replacement = rotateUsedRuneCard(deck, usedCard.id, () => 0);
  assert.equal(deck.hand.length, 8);
  assert.equal(deck.warehouse.length, 1);
  assert.equal(previousWarehouseIds.has(replacement.id), true);
  assert.equal(deck.warehouse.some((card) => card.id === usedCard.id), true);
  assert.equal(deck.hand.some((card) => card.id === usedCard.id), false);
  assert.equal(deck.hand.at(-1).id, replacement.id);
});

test("새로고침은 현재 손패를 버리고 기존 창고 카드부터 오른쪽에 다시 뽑는다", () => {
  const deck = createRuneDeck(createRuneCardPool(RUNE_CARDS), { random: () => 0 });
  const oldHandIds = new Set(deck.hand.map((card) => card.deckId));
  const oldWarehouseIds = new Set(deck.warehouse.map((card) => card.deckId));
  refreshRuneHand(deck, () => 0);
  assert.equal(deck.hand.length, 8);
  assert.ok(deck.hand.every((card) => oldWarehouseIds.has(card.deckId)));
  assert.ok(deck.warehouse.some((card) => oldHandIds.has(card.deckId)));
});

test("초기 카드 풀에는 각 속성의 1스킬 카드가 두 장씩 들어 있다", () => {
  const pool = createRuneCardPool(RUNE_CARDS);
  assert.equal(pool.length, 18);
  for (const card of RUNE_CARDS) {
    assert.equal(pool.filter((candidate) => candidate.id === card.id).length, 2);
    assert.ok(pool.filter((candidate) => candidate.id === card.id).every((candidate) => candidate.skillTier === 1));
  }
  assert.equal(new Set(pool.map((card) => card.deckId)).size, 18);
});

test("상점에서 산 2스킬 카드 두 장은 선택 버튼 없이 창고에 추가된다", () => {
  const deck = createRuneDeck(createRuneCardPool(RUNE_CARDS), { random: () => 0 });
  const fireCard = RUNE_CARDS.find((card) => card.id === "fire");
  const before = deck.warehouse.length;
  const added = addSecondSkillCardsToWarehouse(deck, fireCard);
  assert.equal(added.length, 2);
  assert.equal(deck.warehouse.length, before + 2);
  assert.ok(added.every((card) => card.skillTier === 2));
  assert.equal(addSecondSkillCardsToWarehouse(deck, fireCard).length, 0);
});
