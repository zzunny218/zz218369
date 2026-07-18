export function createRuneCardPool(cards, { copiesPerElement = 2 } = {}) {
  return cards.flatMap((card) => Array.from({ length: copiesPerElement }, (_, copyIndex) => ({
    ...card,
    skillTier: 1,
    deckId: `${card.id}-skill-1-copy-${copyIndex + 1}`,
    copyIndex: copyIndex + 1,
  })));
}

export function addSecondSkillCardsToWarehouse(deck, card, { copies = 2 } = {}) {
  return addSkillCardsToWarehouse(deck, card, 2, { copies });
}

export function addThirdSkillCardsToWarehouse(deck, card, { copies = 1 } = {}) {
  return addSkillCardsToWarehouse(deck, card, 3, { copies });
}

export function addSkillCardsToWarehouse(deck, card, skillTier, { copies = 2 } = {}) {
  if (!deck || !card || copies <= 0) return [];
  const alreadyStored = [...deck.hand, ...deck.warehouse]
    .some((candidate) => candidate.id === card.id && candidate.skillTier === skillTier);
  if (alreadyStored) return [];
  const addedCards = Array.from({ length: copies }, (_, copyIndex) => ({
    ...card,
    skillTier,
    deckId: `${card.id}-skill-${skillTier}-copy-${copyIndex + 1}`,
    copyIndex: copyIndex + 1,
  }));
  deck.warehouse.push(...addedCards);
  return addedCards;
}

function deckCardKey(card) {
  return card.deckId ?? card.id;
}

/** 룬 카드 풀 중 무작위 8장을 손패로 만들고 나머지는 창고에 보관한다. */
export function createRuneDeck(cards, { handSize = 8, random = Math.random } = {}) {
  const warehouse = [...cards];
  const hand = [];
  const targetHandSize = Math.min(handSize, warehouse.length);
  while (hand.length < targetHandSize) {
    const index = Math.floor(random() * warehouse.length);
    hand.push(...warehouse.splice(index, 1));
  }
  return { hand, warehouse };
}

/** 사용한 카드는 창고로 보내고, 기존 창고에서 먼저 새 카드 한 장을 뽑는다. */
export function rotateUsedRuneCard(deck, usedCardId, random = Math.random) {
  const usedIndex = deck.hand.findIndex((card) => deckCardKey(card) === usedCardId);
  if (usedIndex < 0) return null;
  const [usedCard] = deck.hand.splice(usedIndex, 1);
  let replacement = null;
  if (deck.warehouse.length > 0) {
    const drawIndex = Math.floor(random() * deck.warehouse.length);
    [replacement] = deck.warehouse.splice(drawIndex, 1);
    // 새로 뽑은 카드는 언제나 손패의 가장 오른쪽에 쌓인다.
    deck.hand.push(replacement);
  }
  deck.warehouse.push(usedCard);
  return replacement;
}

/** 현재 손패를 버리고, 기존 창고의 카드부터 같은 수만큼 다시 뽑는다. */
export function refreshRuneHand(deck, random = Math.random) {
  if (!deck) return [];
  const discarded = deck.hand.splice(0);
  const targetSize = discarded.length;
  while (deck.hand.length < targetSize && deck.warehouse.length > 0) {
    const drawIndex = Math.floor(random() * deck.warehouse.length);
    deck.hand.push(...deck.warehouse.splice(drawIndex, 1));
  }
  deck.warehouse.push(...discarded);
  while (deck.hand.length < targetSize && deck.warehouse.length > 0) {
    const drawIndex = Math.floor(random() * deck.warehouse.length);
    deck.hand.push(...deck.warehouse.splice(drawIndex, 1));
  }
  return deck.hand;
}
