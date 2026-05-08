# Phase 2: 서버 + Socket.io 통신 — ✅ 완료

> 방 관리, 게임 상태 오케스트레이터, Socket 이벤트 연결.

---

## Socket 이벤트 목록 (서버 ↔ 클라이언트)

| 방향 | 이벤트 | 데이터 |
|------|--------|--------|
| C→S | `create-room` | `{ roomName, maxPlayers, nickname }` |
| C→S | `join-room` | `{ roomId, nickname }` |
| C→S | `leave-room` | — |
| C→S | `start-game` | — (방장만) |
| C→S | `play-cards` | `{ cards: string[] }` |
| C→S | `pass` | — |
| C→S | `return-tax` | `{ cards: string[] }` (대부호/부호가 돌려줄 카드 선택) |
| S→C | `room-list` | `{ rooms: Room[] }` |
| S→C | `room-joined` | `{ roomId, players, isHost }` |
| S→C | `room-updated` | `{ players }` |
| S→C | `game-started` | `{ hand: string[], turnOrder, currentPlayerId, gameNumber }` |
| S→C | `tax-auto` | `{ from, to, count }` (자동 세금 알림) |
| S→C | `tax-return-required` | `{ role, hand, count }` (대부호/부호에게 반환 요청) |
| S→C | `state-updated` | `{ tableCards, currentPlayerId, passCount, revolution, players }` |
| S→C | `round-ended` | `{ reason, nextPlayerId }` |
| S→C | `player-finished` | `{ playerId, rank }` |
| S→C | `revolution` | `{ playerId, active }` |
| S→C | `president-penalty` | `{ playerId }` |
| S→C | `game-over` | `{ ranks }` |

---

## 게임 상태(state) 구조

```js
{
  gameNumber: number,          // 1부터 시작
  revolution: boolean,
  phase: 'playing' | 'tax',   // tax는 2번째 게임부터 세금 교환 중
  taxStep: null | 'president-return' | 'vice-return',
  players: {                   // id → player 객체
    [id]: { id, nickname, hand: string[], finished: boolean }
  },
  turnOrder: string[],         // 현재 게임에 남아있는 플레이어 id 목록 (시계 방향)
  currentIndex: number,        // turnOrder 내 현재 턴 인덱스
  tableCards: string[],        // 이번 판 테이블 위 카드
  prevTableCards: string[],    // 직전 플레이 카드 (♠Reversal 체크용)
  passCount: number,
  lastPlayerId: string | null, // 마지막으로 카드 낸 플레이어 id
  finishedOrder: string[],     // 손패 다 낸 순서 (계급 산정용)
  ranks: {},                   // { id: 'president' | ... } (이전 게임 계급)
  presidentId: string | null,  // 현재 게임의 대부호 (방어 실패 체크용)
}
```

---

## Task 6: `game-state.js` — 게임 상태 오케스트레이터 — 🔲 미완료

**파일:** `server/game/game-state.js`, `tests/game-state.test.js`

- [ ] 테스트 작성 (`tests/game-state.test.js`)
```js
const { createGameState, playCards, pass } = require('../server/game/game-state');

function makeState(playerCount = 3) {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i+1}`, nickname: `Player${i+1}`
  }));
  return createGameState(players, 1, {});
}

test('초기 상태: 3명 플레이어 생성', () => {
  const state = makeState(3);
  expect(Object.keys(state.players).length).toBe(3);
  expect(state.turnOrder.length).toBe(3);
  expect(state.revolution).toBe(false);
  expect(state.phase).toBe('playing');
});

test('초기 상태: 카드 총 54장 배분', () => {
  const state = makeState(4);
  const total = Object.values(state.players).reduce((s, p) => s + p.hand.length, 0);
  expect(total).toBe(54);
});

test('카드 내기: 첫 선은 아무 카드나 낼 수 있음', () => {
  const state = makeState(3);
  const currentId = state.turnOrder[state.currentIndex];
  const card = state.players[currentId].hand[0];
  const { state: next, events } = playCards(state, currentId, [card]);
  expect(next.tableCards).toEqual([card]);
  expect(next.players[currentId].hand).not.toContain(card);
});

test('카드 내기: 자기 차례가 아니면 에러', () => {
  const state = makeState(3);
  const otherId = state.turnOrder[(state.currentIndex + 1) % 3];
  const card = state.players[otherId].hand[0];
  const { error } = playCards(state, otherId, [card]);
  expect(error).toBeDefined();
});

test('패스: passCount 증가', () => {
  const state = makeState(3);
  const firstId = state.turnOrder[state.currentIndex];
  const firstCard = state.players[firstId].hand[0];
  const { state: s1 } = playCards(state, firstId, [firstCard]);
  const secondId = s1.turnOrder[s1.currentIndex];
  const { state: s2 } = pass(s1, secondId);
  expect(s2.passCount).toBe(1);
});

test('전원 패스: 판 종료 이벤트 발생', () => {
  const state = makeState(3);
  const firstId = state.turnOrder[state.currentIndex];
  const firstCard = state.players[firstId].hand[0];
  const { state: s1 } = playCards(state, firstId, [firstCard]);
  const p2 = s1.turnOrder[s1.currentIndex];
  const { state: s2 } = pass(s1, p2);
  const p3 = s2.turnOrder[s2.currentIndex];
  const { events } = pass(s2, p3);
  expect(events.some(e => e.type === 'round-end')).toBe(true);
});
```

- [ ] 테스트 실패 확인: `npx jest tests/game-state.test.js`

- [ ] `server/game/game-state.js` 구현
```js
const { createDeck, deal } = require('./deck');
const { isValidPlay, getRank } = require('./card');
const { checkRoundEnd, checkRevolution } = require('./turn');
const { assignRanks } = require('./rank');

function createGameState(players, gameNumber, prevRanks) {
  const hands = deal(createDeck(), players.length);
  const playerMap = {};
  players.forEach((p, i) => {
    playerMap[p.id] = { id: p.id, nickname: p.nickname, hand: hands[i], finished: false };
  });

  // 대부호 찾기 (방어 실패 체크용)
  const presidentId = Object.keys(prevRanks).find(id => prevRanks[id] === 'president') || null;

  // 첫 게임: 랜덤 선, 이후: 대빈민(scum)이 선
  let firstPlayerId = null;
  if (gameNumber === 1) {
    firstPlayerId = players[Math.floor(Math.random() * players.length)].id;
  } else {
    firstPlayerId = Object.keys(prevRanks).find(id => prevRanks[id] === 'scum');
  }
  const turnOrder = rotateTo(players.map(p => p.id), firstPlayerId);

  return {
    gameNumber,
    revolution: false,
    phase: 'playing',
    taxStep: null,
    players: playerMap,
    turnOrder,
    currentIndex: 0,
    tableCards: [],
    prevTableCards: [],
    passCount: 0,
    lastPlayerId: null,
    finishedOrder: [],
    ranks: prevRanks,
    presidentId,
  };
}

function playCards(state, playerId, cards) {
  if (state.turnOrder[state.currentIndex] !== playerId)
    return { error: 'not-your-turn' };

  const player = state.players[playerId];

  // 테이블이 비어있으면 (선) 아무 카드나 낼 수 있음
  if (state.tableCards.length > 0) {
    if (!isValidPlay(cards, state.tableCards, state.revolution))
      return { error: 'invalid-play' };
  }

  // 손패에서 카드 제거
  const newHand = removeCards(player.hand, cards);
  if (newHand === null) return { error: 'card-not-in-hand' };

  let next = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, hand: newHand },
    },
    prevTableCards: state.tableCards,
    tableCards: cards,
    passCount: 0,
    lastPlayerId: playerId,
  };

  const events = [{ type: 'card-played', playerId, cards }];

  // 혁명 체크
  if (checkRevolution(cards)) {
    next = { ...next, revolution: !next.revolution };
    events.push({ type: 'revolution', playerId, active: next.revolution });
  }

  // 손패 다 냈으면 계급 확정
  if (newHand.length === 0) {
    next = handlePlayerFinished(next, playerId, events);
    if (next.phase === 'gameover') return { state: next, events };
  }

  // 판 종료 체크
  const roundResult = checkRoundEnd({
    tableCards: next.tableCards,
    passCount: next.passCount,
    activePlayers: next.turnOrder.length,
    prevTableCards: next.prevTableCards,
  });

  if (roundResult.ended) {
    next = startNewRound(next, roundResult.reason, events);
  } else {
    next = advanceTurn(next);
  }

  return { state: next, events };
}

function pass(state, playerId) {
  if (state.turnOrder[state.currentIndex] !== playerId)
    return { error: 'not-your-turn' };

  let next = { ...state, passCount: state.passCount + 1 };
  const events = [{ type: 'passed', playerId }];

  const roundResult = checkRoundEnd({
    tableCards: next.tableCards,
    passCount: next.passCount,
    activePlayers: next.turnOrder.length,
    prevTableCards: next.prevTableCards,
  });

  if (roundResult.ended) {
    next = startNewRound(next, roundResult.reason, events);
  } else {
    next = advanceTurn(next);
  }

  return { state: next, events };
}

// --- 내부 헬퍼 ---

function handlePlayerFinished(state, playerId, events) {
  const finishedOrder = [...state.finishedOrder, playerId];
  const turnOrder = state.turnOrder.filter(id => id !== playerId);
  let next = {
    ...state,
    players: { ...state.players, [playerId]: { ...state.players[playerId], finished: true } },
    finishedOrder,
    turnOrder,
    currentIndex: state.currentIndex % Math.max(turnOrder.length, 1),
  };

  // 대부호 방어 실패: 첫 번째로 끝낸 플레이어가 대부호가 아닌 경우
  if (next.presidentId && finishedOrder[0] !== next.presidentId && finishedOrder.length === 1) {
    const president = next.players[next.presidentId];
    if (!president.finished) {
      next = {
        ...next,
        players: { ...next.players, [next.presidentId]: { ...president, finished: true } },
        turnOrder: next.turnOrder.filter(id => id !== next.presidentId),
        finishedOrder: [...finishedOrder], // presidentId는 ranks에서 강제로 scum 처리
      };
      events.push({ type: 'president-penalty', playerId: next.presidentId });
    }
  }

  const rankName = getRankForPosition(finishedOrder.length - 1, state.turnOrder.length + state.finishedOrder.length);
  events.push({ type: 'player-finished', playerId, rank: rankName });

  // 1명 남으면 게임 종료 (마지막 남은 사람 = scum)
  if (next.turnOrder.length <= 1) {
    if (next.turnOrder.length === 1) {
      const lastId = next.turnOrder[0];
      next = {
        ...next,
        players: { ...next.players, [lastId]: { ...next.players[lastId], finished: true } },
        turnOrder: [],
        finishedOrder: [...next.finishedOrder, lastId],
      };
      events.push({ type: 'player-finished', playerId: lastId, rank: 'scum' });
    }
    next = { ...next, phase: 'gameover' };
    const finalOrder = next.presidentId && !next.finishedOrder.includes(next.presidentId)
      ? [...next.finishedOrder] // presidentId penalty already handled
      : next.finishedOrder;
    const ranks = assignRanks(finalOrder);
    // 대부호 방어 실패 시 강제로 scum 덮어쓰기
    if (next.presidentId && events.some(e => e.type === 'president-penalty')) {
      ranks[next.presidentId] = 'scum';
    }
    events.push({ type: 'game-over', ranks });
    next = { ...next, ranks };
  }

  return next;
}

function startNewRound(state, reason, events) {
  let nextPlayerId;
  if (reason === 'all-pass') {
    // 마지막으로 낸 플레이어가 선, 이미 나갔으면 다음 순서
    nextPlayerId = state.lastPlayerId;
    if (!state.turnOrder.includes(nextPlayerId)) {
      const lastIdx = findNextActive(state.turnOrder, state.lastPlayerId);
      nextPlayerId = state.turnOrder[lastIdx];
    }
  } else {
    // 8-clear, spade-reversal: 낸 플레이어가 선
    nextPlayerId = state.turnOrder[state.currentIndex];
  }

  events.push({ type: 'round-end', reason, nextPlayerId });

  const newIndex = state.turnOrder.indexOf(nextPlayerId);
  return {
    ...state,
    tableCards: [],
    prevTableCards: [],
    passCount: 0,
    lastPlayerId: null,
    currentIndex: newIndex >= 0 ? newIndex : 0,
  };
}

function advanceTurn(state) {
  const nextIndex = (state.currentIndex + 1) % state.turnOrder.length;
  return { ...state, currentIndex: nextIndex };
}

function rotateTo(arr, targetId) {
  const idx = arr.indexOf(targetId);
  if (idx <= 0) return arr;
  return [...arr.slice(idx), ...arr.slice(0, idx)];
}

function removeCards(hand, cards) {
  const h = [...hand];
  for (const card of cards) {
    const idx = h.indexOf(card);
    if (idx === -1) return null;
    h.splice(idx, 1);
  }
  return h;
}

function getRankForPosition(position, totalPlayers) {
  const ranks = assignRanks(Array.from({ length: totalPlayers }, (_, i) => `p${i}`));
  return Object.values(ranks)[position];
}

function findNextActive(turnOrder, fromId) {
  const idx = turnOrder.indexOf(fromId);
  return (idx + 1) % turnOrder.length;
}

module.exports = { createGameState, playCards, pass };
```

- [ ] 테스트 통과 확인: `npx jest tests/game-state.test.js`
- [ ] 커밋: `feat: 게임 상태 오케스트레이터`

---

## Task 7: `room-manager.js` — 방 관리 — 🔲 미완료

**파일:** `server/room-manager.js`, `tests/room-manager.test.js`

- [ ] 테스트 작성 (`tests/room-manager.test.js`)
```js
const { createRoom, joinRoom, leaveRoom, getRoomList, getRoom } = require('../server/room-manager');

beforeEach(() => {
  // 각 테스트마다 깨끗한 상태
  jest.resetModules();
});

test('방 생성', () => {
  const { createRoom, getRoom } = require('../server/room-manager');
  const room = createRoom('host1', 'Alice', 'Alice의 방', 4);
  expect(room.name).toBe('Alice의 방');
  expect(room.maxPlayers).toBe(4);
  expect(room.players[0]).toMatchObject({ id: 'host1', nickname: 'Alice' });
  expect(getRoom(room.id)).toBe(room);
});

test('방 입장', () => {
  const { createRoom, joinRoom } = require('../server/room-manager');
  const room = createRoom('host1', 'Alice', '테스트방', 4);
  const result = joinRoom(room.id, 'p2', 'Bob');
  expect(result.players.length).toBe(2);
});

test('인원 초과 시 입장 불가', () => {
  const { createRoom, joinRoom } = require('../server/room-manager');
  const room = createRoom('host1', 'Alice', '꽉찬방', 3);
  joinRoom(room.id, 'p2', 'Bob');
  joinRoom(room.id, 'p3', 'Carol');
  const result = joinRoom(room.id, 'p4', 'Dave');
  expect(result.error).toBeDefined();
});

test('방 퇴장', () => {
  const { createRoom, joinRoom, leaveRoom } = require('../server/room-manager');
  const room = createRoom('host1', 'Alice', '테스트방', 4);
  joinRoom(room.id, 'p2', 'Bob');
  const updated = leaveRoom(room.id, 'p2');
  expect(updated.players.length).toBe(1);
});

test('마지막 플레이어 퇴장 시 방 삭제', () => {
  const { createRoom, leaveRoom, getRoom } = require('../server/room-manager');
  const room = createRoom('host1', 'Alice', '테스트방', 4);
  leaveRoom(room.id, 'host1');
  expect(getRoom(room.id)).toBeNull();
});
```

- [ ] 테스트 실패 확인: `npx jest tests/room-manager.test.js`
- [ ] `server/room-manager.js` 구현
```js
const { v4: uuidv4 } = require('uuid');

const rooms = new Map();

function createRoom(hostId, hostNickname, roomName, maxPlayers) {
  const room = {
    id: uuidv4().slice(0, 6).toUpperCase(),
    name: roomName,
    hostId,
    maxPlayers,
    status: 'waiting',
    players: [{ id: hostId, nickname: hostNickname }],
  };
  rooms.set(room.id, room);
  return room;
}

function joinRoom(roomId, playerId, nickname) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'room-not-found' };
  if (room.status !== 'waiting') return { error: 'game-in-progress' };
  if (room.players.length >= room.maxPlayers) return { error: 'room-full' };
  if (room.players.find(p => p.id === playerId)) return room;
  room.players.push({ id: playerId, nickname });
  return room;
}

function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    rooms.delete(roomId);
    return null;
  }
  if (room.hostId === playerId) room.hostId = room.players[0].id;
  return room;
}

function getRoomList() {
  return Array.from(rooms.values()).map(r => ({
    id: r.id, name: r.name, maxPlayers: r.maxPlayers,
    currentPlayers: r.players.length, status: r.status,
  }));
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function setRoomStatus(roomId, status) {
  const room = rooms.get(roomId);
  if (room) room.status = status;
}

module.exports = { createRoom, joinRoom, leaveRoom, getRoomList, getRoom, setRoomStatus };
```

- [ ] uuid 설치: `npm install uuid`
- [ ] 테스트 통과 확인: `npx jest tests/room-manager.test.js`
- [ ] 커밋: `feat: 방 관리 (생성/입장/퇴장)`

---

## Task 8: `server.js` — Express + Socket.io — 🔲 미완료

**파일:** `server/server.js`

- [ ] `server/server.js` 구현
```js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createRoom, joinRoom, leaveRoom, getRoomList, getRoom, setRoomStatus } = require('./room-manager');
const { createGameState, playCards, pass } = require('./game/game-state');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));

const gameStates = new Map(); // roomId → gameState
const playerRooms = new Map(); // socketId → roomId

io.on('connection', (socket) => {
  // 로비: 방 목록 요청
  socket.on('get-room-list', () => {
    socket.emit('room-list', { rooms: getRoomList() });
  });

  // 방 만들기
  socket.on('create-room', ({ roomName, maxPlayers, nickname }) => {
    const room = createRoom(socket.id, nickname, roomName, maxPlayers);
    socket.join(room.id);
    playerRooms.set(socket.id, room.id);
    socket.emit('room-joined', { roomId: room.id, players: room.players, isHost: true });
    io.emit('room-list', { rooms: getRoomList() });
  });

  // 방 입장
  socket.on('join-room', ({ roomId, nickname }) => {
    const result = joinRoom(roomId, socket.id, nickname);
    if (result.error) return socket.emit('error', { message: result.error });
    socket.join(roomId);
    playerRooms.set(socket.id, roomId);
    socket.emit('room-joined', { roomId, players: result.players, isHost: result.hostId === socket.id });
    socket.to(roomId).emit('room-updated', { players: result.players });
    io.emit('room-list', { rooms: getRoomList() });
  });

  // 게임 시작
  socket.on('start-game', () => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 3) return socket.emit('error', { message: 'need-3-players' });

    const prevRanks = gameStates.get(roomId)?.ranks || {};
    const gameNumber = (gameStates.get(roomId)?.gameNumber || 0) + 1;
    const state = createGameState(room.players, gameNumber, prevRanks);
    gameStates.set(roomId, state);
    setRoomStatus(roomId, 'playing');

    room.players.forEach(p => {
      const playerSocket = [...io.sockets.sockets.values()].find(s => s.id === p.id);
      if (playerSocket) {
        playerSocket.emit('game-started', {
          hand: state.players[p.id].hand,
          turnOrder: state.turnOrder,
          currentPlayerId: state.turnOrder[state.currentIndex],
          gameNumber,
        });
      }
    });
    io.emit('room-list', { rooms: getRoomList() });
  });

  // 카드 내기
  socket.on('play-cards', ({ cards }) => {
    const roomId = playerRooms.get(socket.id);
    const state = gameStates.get(roomId);
    if (!state) return;
    const result = playCards(state, socket.id, cards);
    if (result.error) return socket.emit('error', { message: result.error });
    gameStates.set(roomId, result.state);
    broadcastEvents(io, roomId, result.state, result.events);
  });

  // 패스
  socket.on('pass', () => {
    const roomId = playerRooms.get(socket.id);
    const state = gameStates.get(roomId);
    if (!state) return;
    const result = pass(state, socket.id);
    if (result.error) return socket.emit('error', { message: result.error });
    gameStates.set(roomId, result.state);
    broadcastEvents(io, roomId, result.state, result.events);
  });

  // 연결 끊김
  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    playerRooms.delete(socket.id);
    const room = leaveRoom(roomId, socket.id);
    if (room) {
      io.to(roomId).emit('room-updated', { players: room.players });
    }
    io.emit('room-list', { rooms: getRoomList() });
  });
});

function broadcastEvents(io, roomId, state, events) {
  // 전체 상태 업데이트 (손패 제외)
  const publicState = {
    tableCards: state.tableCards,
    currentPlayerId: state.turnOrder[state.currentIndex] || null,
    passCount: state.passCount,
    revolution: state.revolution,
    players: Object.values(state.players).map(p => ({
      id: p.id, nickname: p.nickname, cardCount: p.hand.length, finished: p.finished,
    })),
  };
  io.to(roomId).emit('state-updated', publicState);

  // 개별 이벤트 브로드캐스트
  for (const event of events) {
    io.to(roomId).emit(event.type, event);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
```

- [ ] 서버 실행 확인: `npm start` → `Server running on http://localhost:3000`
- [ ] 커밋: `feat: Express + Socket.io 서버`
