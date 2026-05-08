# Phase 1: 프로젝트 초기 설정 + 게임 로직 — 🔲 미완료

> 순수 함수로 게임 규칙 전체 구현 + Jest 테스트. 서버/클라이언트 없이 로직만 검증.

---

## Task 1: 프로젝트 초기화 — 🔲 미완료

- [ ] 의존성 설치
```bash
npm init -y
npm install express socket.io
npm install --save-dev jest
```
- [ ] `package.json` scripts 수정
```json
"scripts": {
  "start": "node server/server.js",
  "test": "jest"
}
```
- [ ] `.gitignore` 생성 (`node_modules/`)
- [ ] 커밋

---

## Task 2: `card.js` — 카드 강약 비교 및 유효성 검사 — 🔲 미완료

**파일:** `server/game/card.js`, `tests/card.test.js`

- [ ] 테스트 작성 (`tests/card.test.js`)
```js
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
```
- [ ] 테스트 실패 확인: `npx jest tests/card.test.js`
- [ ] `server/game/card.js` 구현
```js
const BASE_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','Joker'];
const REV_ORDER  = ['2','A','K','Q','J','10','9','8','7','6','5','4','3','Joker'];

function getRank(card, revolution = false) {
  const num = card === 'Joker' ? 'Joker' : card.slice(0, -1);
  const order = revolution ? REV_ORDER : BASE_ORDER;
  return order.indexOf(num);
}

function compareCards(a, b, revolution = false) {
  return getRank(a, revolution) - getRank(b, revolution);
}

function getPlayNumber(cards, revolution = false) {
  const nonJoker = cards.filter(c => c !== 'Joker');
  if (nonJoker.length === 0) return getRank('Joker', revolution);
  return getRank(nonJoker[0], revolution);
}

function isValidPlay(cards, tableCards, revolution = false) {
  if (cards.length !== tableCards.length) return false;
  return getPlayNumber(cards, revolution) > getPlayNumber(tableCards, revolution);
}

module.exports = { compareCards, isValidPlay, getRank, getPlayNumber };
```
- [ ] 테스트 통과 확인: `npx jest tests/card.test.js`
- [ ] 커밋: `feat: 카드 강약 비교 및 유효성 검사`

---

## Task 3: `deck.js` — 덱 생성, 셔플, 배분 — 🔲 미완료

**파일:** `server/game/deck.js`, `tests/deck.test.js`

- [ ] 테스트 작성 (`tests/deck.test.js`)
```js
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
```
- [ ] 테스트 실패 확인: `npx jest tests/deck.test.js`
- [ ] `server/game/deck.js` 구현
```js
const SUITS = ['S','H','D','C'];
const NUMS  = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

function createDeck() {
  const deck = [];
  for (const num of NUMS)
    for (const suit of SUITS)
      deck.push(num + suit);
  deck.push('Joker', 'Joker');
  return deck;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function deal(deck, playerCount) {
  const shuffled = shuffle(deck);
  const hands = Array.from({ length: playerCount }, () => []);
  shuffled.forEach((card, i) => hands[i % playerCount].push(card));
  return hands;
}

module.exports = { createDeck, shuffle, deal };
```
- [ ] 테스트 통과 확인: `npx jest tests/deck.test.js`
- [ ] 커밋: `feat: 덱 생성, 셔플, 배분`

---

## Task 4: `turn.js` — 판 종료 및 혁명 감지 — 🔲 미완료

**파일:** `server/game/turn.js`, `tests/turn.test.js`

- [ ] 테스트 작성 (`tests/turn.test.js`)
```js
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
```
- [ ] 테스트 실패 확인: `npx jest tests/turn.test.js`
- [ ] `server/game/turn.js` 구현
```js
function getNum(card) {
  return card === 'Joker' ? 'Joker' : card.slice(0, -1);
}

function checkRoundEnd({ tableCards, passCount, activePlayers, prevTableCards = [] }) {
  const last = tableCards[tableCards.length - 1];
  const num  = getNum(last);

  if (num === '8') return { ended: true, reason: '8-clear' };

  if (prevTableCards.length === 1 && prevTableCards[0] === 'Joker' && last === '3S')
    return { ended: true, reason: 'spade-reversal' };

  if (passCount >= activePlayers - 1) return { ended: true, reason: 'all-pass' };

  return { ended: false };
}

// 조커는 와일드카드로 장수만 채움
function checkRevolution(cards) {
  if (cards.length !== 4) return false;
  const nonJoker = cards.filter(c => c !== 'Joker');
  const nums = nonJoker.map(getNum);
  return new Set(nums).size === 1;
}

module.exports = { checkRoundEnd, checkRevolution };
```
- [ ] 테스트 통과 확인: `npx jest tests/turn.test.js`
- [ ] 커밋: `feat: 판 종료 감지 및 혁명 감지`

---

## Task 5: `rank.js` — 계급 산정 및 세금 카드 선정 — 🔲 미완료

**파일:** `server/game/rank.js`, `tests/rank.test.js`

- [ ] 테스트 작성 (`tests/rank.test.js`)
```js
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
```
- [ ] 테스트 실패 확인: `npx jest tests/rank.test.js`
- [ ] `server/game/rank.js` 구현
```js
const { getRank } = require('./card');

const RANK_MAP = {
  3: ['president', 'citizen', 'scum'],
  4: ['president', 'vice-president', 'vice-scum', 'scum'],
};

function buildRanks(n) {
  return ['president', 'vice-president', ...Array(n - 4).fill('citizen'), 'vice-scum', 'scum'];
}

function assignRanks(orderedPlayerIds) {
  const n = orderedPlayerIds.length;
  const ranks = RANK_MAP[n] || buildRanks(n);
  const result = {};
  orderedPlayerIds.forEach((id, i) => { result[id] = ranks[i]; });
  return result;
}

function getTaxCards(hand, count) {
  return [...hand]
    .filter(c => c !== 'Joker')
    .sort((a, b) => getRank(b) - getRank(a))
    .slice(0, count);
}

module.exports = { assignRanks, getTaxCards, buildRanks };
```
- [ ] 테스트 통과 확인: `npx jest tests/rank.test.js`
- [ ] 커밋: `feat: 계급 산정 및 세금 카드 선정`
