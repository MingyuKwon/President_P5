const { createDeck, deal } = require('../server/game/deck');

test('덱은 54장', () => {
  expect(createDeck().length).toBe(54);
});
test('조커 2장 포함', () => {
  expect(createDeck().filter(c => c === 'Joker').length).toBe(2);
});
test('4명에게 배분 시 총 54장', () => {
  const hands = deal(createDeck(), 4);
  expect(hands.reduce((s, h) => s + h.length, 0)).toBe(54);
});
test('4명 배분 시 손패 장수 차이 최대 1', () => {
  const hands = deal(createDeck(), 4);
  const lengths = hands.map(h => h.length);
  expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
});
