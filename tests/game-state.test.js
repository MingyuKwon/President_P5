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
