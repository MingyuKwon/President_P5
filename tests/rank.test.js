const { assignRanks, getTaxCards } = require('../server/game/rank');

test('3명 순위 → 계급 배정', () => {
  expect(assignRanks(['p1','p2','p3']))
    .toEqual({ p1:'president', p2:'citizen', p3:'scum' });
});
test('4명 순위 → 계급 배정', () => {
  expect(assignRanks(['p1','p2','p3','p4']))
    .toEqual({ p1:'president', p2:'vice-president', p3:'vice-scum', p4:'scum' });
});
test('5명 순위 → 계급 배정', () => {
  expect(assignRanks(['p1','p2','p3','p4','p5']))
    .toEqual({ p1:'president', p2:'vice-president', p3:'citizen', p4:'vice-scum', p5:'scum' });
});
test('세금: 가장 강한 카드 2장 (조커 제외)', () => {
  expect(getTaxCards(['2H','AS','KD','Joker','3C'], 2)).toEqual(['2H','AS']);
});
