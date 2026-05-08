const { checkRoundEnd, checkRevolution } = require('../server/game/turn');

test('전원 패스 시 판 종료', () => {
  expect(checkRoundEnd({ tableCards: ['5H'], passCount: 2, activePlayers: 3 }))
    .toEqual({ ended: true, reason: 'all-pass' });
});
test('8 내면 8-Clear', () => {
  expect(checkRoundEnd({ tableCards: ['8H'], passCount: 0, activePlayers: 3 }))
    .toEqual({ ended: true, reason: '8-clear' });
});
test('조커만 있을 때 ♠3 내면 Spade Reversal', () => {
  expect(checkRoundEnd({ tableCards: ['3S'], passCount: 0, activePlayers: 3, prevTableCards: ['Joker'] }))
    .toEqual({ ended: true, reason: 'spade-reversal' });
});
test('일반 카드는 판 유지', () => {
  expect(checkRoundEnd({ tableCards: ['7H'], passCount: 0, activePlayers: 3 }))
    .toEqual({ ended: false });
});
test('같은 숫자 4장 → 혁명', () => {
  expect(checkRevolution(['5H','5D','5S','5C'])).toBe(true);
});
test('조커 포함 4장 → 혁명', () => {
  expect(checkRevolution(['5H','5D','5S','Joker'])).toBe(true);
});
test('3장은 혁명 아님', () => {
  expect(checkRevolution(['5H','5D','5S'])).toBe(false);
});
test('다른 숫자 섞이면 혁명 아님', () => {
  expect(checkRevolution(['5H','5D','5S','6C'])).toBe(false);
});
