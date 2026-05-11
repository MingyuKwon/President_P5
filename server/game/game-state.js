const { createDeck, deal } = require('./deck');
const { isValidPlay } = require('./card');
const { checkRoundEnd, checkRevolution } = require('./turn');
const { assignRanks } = require('./rank');

function createGameState(players, gameNumber, prevRanks) {
  const hands = deal(createDeck(), players.length);
  const playerMap = {};
  players.forEach((p, i) => {
    playerMap[p.id] = { id: p.id, nickname: p.nickname, hand: hands[i], finished: false };
  });

  const presidentId = Object.keys(prevRanks).find(id => prevRanks[id] === 'president') || null;

  let firstPlayerId;
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
    players: playerMap,
    turnOrder,
    currentIndex: 0,
    tableCards: [],
    prevTableCards: [],
    tablePile: [],
    passCount: 0,
    lastPlayerId: null,
    finishedOrder: [],
    ranks: prevRanks,
    presidentId,
    presidentPenalty: false,
  };
}

function playCards(state, playerId, cards) {
  if (state.turnOrder[state.currentIndex] !== playerId)
    return { error: 'not-your-turn' };

  const player = state.players[playerId];

  if (state.tableCards.length > 0) {
    if (!isValidPlay(cards, state.tableCards, state.revolution))
      return { error: 'invalid-play' };
  }

  const newHand = removeCards(player.hand, cards);
  if (newHand === null) return { error: 'card-not-in-hand' };

  let next = {
    ...state,
    players: { ...state.players, [playerId]: { ...player, hand: newHand } },
    prevTableCards: state.tableCards,
    tableCards: cards,
    tablePile: [...(state.tablePile || []), cards],
    passCount: 0,
    lastPlayerId: playerId,
  };

  const events = [{ type: 'card-played', playerId, cards }];

  if (checkRevolution(cards)) {
    next = { ...next, revolution: !next.revolution };
    events.push({ type: 'revolution', playerId, active: next.revolution });
  }

  if (newHand.length === 0) {
    next = handlePlayerFinished(next, playerId, events);
    if (next.phase === 'gameover') return { state: next, events };
  }

  const roundResult = checkRoundEnd({
    tableCards: next.tableCards,
    passCount: next.passCount,
    activePlayers: next.turnOrder.length,
    prevTableCards: next.prevTableCards,
  });

  if (roundResult.ended) {
    next = startNewRound(next, roundResult.reason, playerId, events);
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
    next = startNewRound(next, roundResult.reason, null, events);
  } else {
    next = advanceTurn(next);
  }

  return { state: next, events };
}

function handlePlayerFinished(state, playerId, events) {
  const finishedOrder = [...state.finishedOrder, playerId];
  let turnOrder = state.turnOrder.filter(id => id !== playerId);
  let next = {
    ...state,
    players: { ...state.players, [playerId]: { ...state.players[playerId], finished: true } },
    finishedOrder,
    turnOrder,
    currentIndex: turnOrder.length > 0 ? state.currentIndex % turnOrder.length : 0,
  };

  // 대부호 방어 실패: 다른 사람이 먼저 끝냄
  if (next.presidentId && next.presidentId !== playerId && finishedOrder.length === 1) {
    const president = next.players[next.presidentId];
    if (president && !president.finished) {
      const newTurnOrder = next.turnOrder.filter(id => id !== next.presidentId);
      next = {
        ...next,
        players: { ...next.players, [next.presidentId]: { ...president, finished: true } },
        turnOrder: newTurnOrder,
        currentIndex: newTurnOrder.length > 0 ? next.currentIndex % newTurnOrder.length : 0,
        presidentPenalty: true,
      };
      events.push({ type: 'president-penalty', playerId: next.presidentId });
    }
  }

  const totalPlayers = Object.keys(state.players).length;
  const rankName = getRankForPosition(finishedOrder.length - 1, totalPlayers);
  events.push({ type: 'player-finished', playerId, rank: rankName });

  if (next.turnOrder.length <= 1) {
    if (next.turnOrder.length === 1) {
      const lastId = next.turnOrder[0];
      const updatedFinishedOrder = [...next.finishedOrder, lastId];
      next = {
        ...next,
        players: { ...next.players, [lastId]: { ...next.players[lastId], finished: true } },
        turnOrder: [],
        finishedOrder: updatedFinishedOrder,
      };
      events.push({ type: 'player-finished', playerId: lastId, rank: 'scum' });
    }
    next = { ...next, phase: 'gameover' };
    // 몰락한 대부호를 finishedOrder 마지막에 추가해 전체 인원 기준으로 순위 계산
    let finalFinishedOrder = next.finishedOrder;
    if (next.presidentPenalty && !finalFinishedOrder.includes(next.presidentId)) {
      finalFinishedOrder = [...finalFinishedOrder, next.presidentId];
    }
    const ranks = assignRanks(finalFinishedOrder);
    if (next.presidentPenalty) {
      ranks[next.presidentId] = 'scum';
    }
    events.push({ type: 'game-over', ranks });
    next = { ...next, ranks, finishedOrder: finalFinishedOrder };
  }

  return next;
}

function startNewRound(state, reason, lastCardPlayerId, events) {
  let nextPlayerId;
  if (reason === 'all-pass') {
    nextPlayerId = state.lastPlayerId;
    if (!state.turnOrder.includes(nextPlayerId)) {
      nextPlayerId = state.turnOrder[state.currentIndex % state.turnOrder.length];
    }
  } else {
    nextPlayerId = lastCardPlayerId || state.turnOrder[state.currentIndex];
    // 마지막 카드를 낸 플레이어가 allout되어 turnOrder에서 제거된 경우
    // 해당 플레이어가 있던 인덱스의 다음 사람이 선
    if (!state.turnOrder.includes(nextPlayerId)) {
      nextPlayerId = state.turnOrder[state.currentIndex % state.turnOrder.length];
    }
  }

  events.push({ type: 'round-end', reason, nextPlayerId });

  const newIndex = state.turnOrder.indexOf(nextPlayerId);
  return {
    ...state,
    tableCards: [],
    prevTableCards: [],
    tablePile: [],
    passCount: 0,
    lastPlayerId: null,
    currentIndex: newIndex >= 0 ? newIndex : 0,
  };
}

function advanceTurn(state) {
  return { ...state, currentIndex: (state.currentIndex + 1) % state.turnOrder.length };
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
  const dummies = Array.from({ length: totalPlayers }, (_, i) => `p${i}`);
  const ranks = assignRanks(dummies);
  return Object.values(ranks)[position];
}

module.exports = { createGameState, playCards, pass };
