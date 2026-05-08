# 대부호 구현 계획

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | HTML / CSS / JavaScript + GSAP (애니메이션) |
| 백엔드 | Node.js + Express |
| 실시간 통신 | Socket.io (WebSocket) |
| 테스트 | Jest |

## 게임 개요

- 웹 브라우저에서 바로 플레이 가능한 멀티플레이어 카드 게임
- 서버를 켜두면 외부에서 URL로 접속해서 플레이
- 3~8명, 방장이 인원 수 설정
- 로그인 없음 — 닉네임만 입력하고 참가
- CPU 없음 — 사람 플레이어만

## 화면 구성

### 1. 로비 페이지 `/`
- 닉네임 입력
- 방 목록 (방 이름, 현재 인원/최대 인원, 상태)
- 방 만들기 (방 이름, 인원 수 3~8명 설정)
- 방 입장 버튼

### 2. 대기실 페이지 `/room/:roomId`
- 참가한 플레이어 목록
- 방장만 게임 시작 버튼 활성화 (최소 3명 이상)
- URL 공유 버튼

### 3. 게임 페이지 `/room/:roomId/game`
- 내 패 (하단)
- 테이블 (중앙) — 현재 낸 카드들
- 다른 플레이어들 (상단/좌우) — 패 뒷면 + 이름 + 카드 수
- 카드 내기 / 패스 버튼
- 현재 턴 표시, 계급 표시

## 아키텍처

```
[브라우저 클라이언트]
  HTML/CSS/JS + GSAP
       ↕ WebSocket (Socket.io)
[Node.js 서버]
  Express + Socket.io
  - 정적 파일 서빙
  - 방 관리
  - 게임 로직 (서버 전담)
  - 게임 상태 메모리 관리 (DB 없음)
```

게임 로직은 전부 서버에서 처리하고, 클라이언트는 상태를 표시하고 입력을 전달하는 역할만 한다.

## 디렉토리 구조

```
President_P5/
  server/
    game/              ← 순수 로직 (Socket.io 의존 없음)
      deck.js          - 덱 생성, 셔플, 배분
      card.js          - 카드 강약 비교, 유효성 검사
      turn.js          - 턴 진행, 판 종료 감지
      rank.js          - 계급 산정, 세금 교환
      game-state.js    - 게임 상태 관리 (순수 함수)
    room-manager.js    ← 방 목록 관리
    server.js          ← Socket.io / Express 진입점
  client/
    index.html         - 로비
    room.html          - 대기실
    game.html          - 게임
    css/
    js/
  tests/
    deck.test.js
    card.test.js
    turn.test.js
    rank.test.js
  Resource/
    CardImage/         - 카드 이미지 54장 (PNG)
  docs/
    game-rules.md
    plan.md
```

## 게임 로직 모듈

| 모듈 | 역할 |
|------|------|
| `deck.js` | 54장 덱 생성, 셔플, 인원수에 맞게 배분 |
| `card.js` | 카드 강약 비교, 낼 수 있는 카드 유효성 검사, 조커 처리 |
| `turn.js` | 턴 진행, 전원 패스 / 8-Clear / ♠Reversal 감지 |
| `rank.js` | 게임 종료 후 계급 산정, 세금 교환 처리 |
| `game-state.js` | 전체 게임 상태 관리, 순수 함수 `(state, action) → newState` |

## 핵심 규칙 구현 체크리스트

- [ ] 카드 강약 순서 (기본 / 혁명 상태)
- [ ] 여러 장 내기 (같은 숫자, 같은 장수)
- [ ] 조커 단독 / 와일드카드 구분
- [ ] 판 종료 3가지 (전원 패스 / 8-Clear / ♠Reversal)
- [ ] 혁명 발동 및 반혁명
- [ ] 손패 다 냈을 때 즉시 계급 확정 및 이탈
- [ ] 대부호 방어 실패 패널티
- [ ] 세금 교환 (2번째 게임부터)
- [ ] 계급별 나머지 카드 우선 분배

---

## 구현 단계

### Phase 1: 프로젝트 초기 설정 + 게임 로직 — 🔲 미완료

> 순수 함수로 게임 규칙 전체 구현 + Jest 테스트. 서버/클라이언트 없이 로직만 검증.

#### Task 1: 프로젝트 초기화 — 🔲 미완료

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

#### Task 2: `card.js` — 카드 강약 비교 및 유효성 검사 — 🔲 미완료

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

#### Task 3: `deck.js` — 덱 생성, 셔플, 배분 — 🔲 미완료

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

#### Task 4: `turn.js` — 판 종료 감지 — 🔲 미완료

**파일:** `server/game/turn.js`, `tests/turn.test.js`

- [ ] 테스트 작성 (`tests/turn.test.js`)
```js
const { checkRoundEnd } = require('../server/game/turn');

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

module.exports = { checkRoundEnd };
```
- [ ] 테스트 통과 확인: `npx jest tests/turn.test.js`
- [ ] 커밋: `feat: 판 종료 감지 (전원패스/8-Clear/♠Reversal)`

---

#### Task 5: `rank.js` — 계급 산정 및 세금 카드 선정 — 🔲 미완료

**파일:** `server/game/rank.js`, `tests/rank.test.js`

- [ ] 테스트 작성 (`tests/rank.test.js`)
```js
const { assignRanks, getTaxCards } = require('../server/game/rank');

test('4명 순위 → 계급 배정', () => {
  expect(assignRanks(['p1','p2','p3','p4']))
    .toEqual({ p1:'president', p2:'vice-president', p3:'vice-scum', p4:'scum' });
});
test('3명 순위 → 계급 배정', () => {
  expect(assignRanks(['p1','p2','p3']))
    .toEqual({ p1:'president', p2:'citizen', p3:'scum' });
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

---

### Phase 2: 서버 + Socket.io 통신 — 🔲 미완료

> 방 관리, Socket 이벤트, 게임 상태와 클라이언트 연결.

#### Task 6: `game-state.js` — 전체 게임 상태 관리
#### Task 7: `room-manager.js` — 방 생성/입장/퇴장
#### Task 8: `server.js` — Express + Socket.io 진입점
#### Socket 이벤트 목록 (서버 ↔ 클라이언트)

| 방향 | 이벤트 | 내용 |
|------|--------|------|
| C→S | `create-room` | 방 이름, 인원 수 |
| C→S | `join-room` | 방 ID, 닉네임 |
| C→S | `start-game` | (방장만) |
| C→S | `play-cards` | 낼 카드 배열 |
| C→S | `pass` | 패스 |
| S→C | `room-list` | 현재 방 목록 |
| S→C | `room-joined` | 방 입장 성공, 플레이어 목록 |
| S→C | `game-started` | 내 손패, 첫 턴 플레이어 |
| S→C | `game-state` | 매 턴 후 전체 상태 업데이트 |
| S→C | `game-over` | 최종 계급 결과 |

---

### Phase 3: 클라이언트 UI — 🔲 미완료

> 로비, 대기실, 게임 화면 구현 + GSAP 애니메이션.

#### Task 9: 로비 페이지 (`client/index.html`)
#### Task 10: 대기실 페이지 (`client/room.html`)
#### Task 11: 게임 페이지 기본 레이아웃 (`client/game.html`)
#### Task 12: GSAP 카드 애니메이션 (딜링, 내기, 판 종료)
