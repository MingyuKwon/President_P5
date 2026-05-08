const { compareCards, isValidPlay } = require('../server/game/card');

test('기본 강약: 3 < 4', () => {
  expect(compareCards('3H', '4H')).toBeLessThan(0);
});
test('기본 강약: 2 < 조커', () => {
  expect(compareCards('2H', 'Joker')).toBeLessThan(0);
});
test('혁명 시 강약 역전: 3 > 4', () => {
  expect(compareCards('3H', '4H', true)).toBeGreaterThan(0);
});
test('같은 장수, 더 강한 카드 낼 수 있음', () => {
  expect(isValidPlay(['5H', '5D'], ['4H', '4D'], false)).toBe(true);
});
test('장수 다르면 낼 수 없음', () => {
  expect(isValidPlay(['5H'], ['4H', '4D'], false)).toBe(false);
});
test('조커 + K는 Q 2장보다 강함', () => {
  expect(isValidPlay(['Joker', 'KH'], ['QH', 'QD'], false)).toBe(true);
});
test('조커 + J는 Q 2장보다 약함', () => {
  expect(isValidPlay(['Joker', 'JH'], ['QH', 'QD'], false)).toBe(false);
});
test('조커 단독은 2보다 강함', () => {
  expect(isValidPlay(['Joker'], ['2H'], false)).toBe(true);
});
