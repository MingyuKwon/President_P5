const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createRoom, joinRoom, leaveRoom, closeRoom, getRoomList, getRoom, setRoomStatus, updateSocketId } = require('./room-manager');
const { createGameState, playCards, pass } = require('./game/game-state');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));
app.use('/Resource', express.static(path.join(__dirname, '../Resource')));

const gameStates = new Map();   // roomId → gameState
const sessionMap = new Map();   // sessionId → { socketId, roomId }
const socketSession = new Map(); // socketId → sessionId
const turnTimers = new Map();   // roomId → timeoutId
const readySets = new Map();    // roomId → Set<sessionId>
const roomScores = new Map();   // roomId → { sessionId → score }
const botPlayers = new Map();   // roomId → Set<sessionId>
const taxStates = new Map();    // roomId → tax info

const TAX_CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
function taxCardStrength(card) { return TAX_CARD_ORDER.indexOf(card.slice(0, -1)); }
function topNonJoker(hand, n) {
  return [...hand].filter(c => c !== 'Joker').sort((a, b) => taxCardStrength(b) - taxCardStrength(a)).slice(0, n);
}

const BOT_CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','Joker'];
const BOT_REV_ORDER  = ['2','A','K','Q','J','10','9','8','7','6','5','4','3','Joker'];

function botCardRank(card, revolution) {
  const num = card === 'Joker' ? 'Joker' : card.slice(0, -1);
  return (revolution ? BOT_REV_ORDER : BOT_CARD_ORDER).indexOf(num);
}

function playBotTurn(roomId, botId) {
  const state = gameStates.get(roomId);
  if (!state || state.turnOrder[state.currentIndex] !== botId) return;

  let result;
  if (state.tableCards.length === 0) {
    const weakest = state.players[botId].hand.reduce((a, b) =>
      botCardRank(a, state.revolution) <= botCardRank(b, state.revolution) ? a : b
    );
    result = playCards(state, botId, [weakest]);
    if (result.error) result = pass(state, botId);
  } else {
    result = pass(state, botId);
  }

  if (result.error) return;
  gameStates.set(roomId, result.state);
  broadcastGameUpdate(roomId, result.state, result.events);
  if (!result.events.some(e => e.type === 'game-over')) {
    startTurnTimer(roomId, result.state);
  }
}

const RANK_SCORES = { president: 30, 'vice-president': 20, citizen: 10, 'vice-scum': 0, scum: -10 };

function updateScores(roomId, ranks) {
  if (!roomScores.has(roomId)) roomScores.set(roomId, {});
  const scores = roomScores.get(roomId);
  for (const [playerId, rank] of Object.entries(ranks)) {
    scores[playerId] = (scores[playerId] || 0) + (RANK_SCORES[rank] ?? 0);
  }
  return { ...scores };
}

const TURN_DURATION = 20; // seconds

function clearTurnTimer(roomId) {
  if (turnTimers.has(roomId)) {
    clearTimeout(turnTimers.get(roomId).timeoutId);
    turnTimers.delete(roomId);
  }
}

function startTurnTimer(roomId, state) {
  clearTurnTimer(roomId);
  const currentPlayerId = state.turnOrder[state.currentIndex] || null;
  if (!currentPlayerId) return;

  // 봇 플레이어: 1.5초 후 자동 처리
  if (botPlayers.get(roomId)?.has(currentPlayerId)) {
    const timeoutId = setTimeout(() => {
      turnTimers.delete(roomId);
      playBotTurn(roomId, currentPlayerId);
    }, 1500);
    turnTimers.set(roomId, { timeoutId, startedAt: Date.now(), playerId: currentPlayerId });
    return;
  }

  io.to(roomId).emit('turn-timer', { playerId: currentPlayerId, duration: TURN_DURATION });

  const timeoutId = setTimeout(() => {
    turnTimers.delete(roomId);
    const currentState = gameStates.get(roomId);
    if (!currentState) return;
    if ((currentState.turnOrder[currentState.currentIndex] || null) !== currentPlayerId) return;

    const result = pass(currentState, currentPlayerId);
    if (result.error) return;
    gameStates.set(roomId, result.state);
    broadcastGameUpdate(roomId, result.state, result.events);
    if (!result.events.some(e => e.type === 'game-over')) {
      startTurnTimer(roomId, result.state);
    }
  }, TURN_DURATION * 1000);
  turnTimers.set(roomId, { timeoutId, startedAt: Date.now(), playerId: currentPlayerId });
}

function broadcastGameUpdate(roomId, state, events) {
  const publicState = {
    tableCards: state.tableCards,
    tablePile: state.tablePile || [],
    currentPlayerId: state.turnOrder[state.currentIndex] || null,
    passCount: state.passCount,
    revolution: state.revolution,
    players: Object.values(state.players).map(p => ({
      id: p.id, nickname: p.nickname, cardCount: p.hand.length, finished: p.finished,
    })),
  };
  io.to(roomId).emit('state-updated', publicState);

  for (const event of events) {
    if (event.type === 'card-played') {
      const sess = sessionMap.get(event.playerId);
      const playerSocket = sess ? io.sockets.sockets.get(sess.socketId) : null;
      if (playerSocket) {
        playerSocket.emit('hand-updated', { hand: state.players[event.playerId].hand });
      }
    }
    if (event.type === 'game-over') {
      const scores = updateScores(roomId, event.ranks);
      io.to(roomId).emit('game-over', { ...event, scores });
    } else {
      io.to(roomId).emit(event.type, event);
    }
  }
}

io.on('connection', (socket) => {

  function getSession(sessionId) {
    if (!sessionMap.has(sessionId)) sessionMap.set(sessionId, { socketId: socket.id, roomId: null });
    const session = sessionMap.get(sessionId);
    session.socketId = socket.id;
    socketSession.set(socket.id, sessionId);
    return session;
  }

  socket.on('get-room-list', () => {
    socket.emit('room-list', { rooms: getRoomList() });
  });

  socket.on('create-room', ({ roomName, nickname, sessionId }) => {
    const session = getSession(sessionId);
    const room = createRoom(sessionId, nickname, roomName);
    socket.join(room.id);
    session.roomId = room.id;
    updateSocketId(room.id, sessionId, socket.id);
    socket.emit('room-joined', { roomId: room.id, players: publicPlayers(room.players), isHost: true });
    io.emit('room-list', { rooms: getRoomList() });
  });

  socket.on('join-room', ({ roomId, nickname, sessionId }) => {
    const session = getSession(sessionId);
    const result = joinRoom(roomId, sessionId, socket.id, nickname);
    if (result.error) return socket.emit('error', { message: result.error });
    socket.join(roomId);
    session.roomId = roomId;
    const isHost = result.hostId === sessionId;
    socket.emit('room-joined', { roomId, players: publicPlayers(result.players), isHost });
    socket.to(roomId).emit('room-updated', { players: publicPlayers(result.players) });
    io.emit('room-list', { rooms: getRoomList() });

    // 게임 진행 중이면 현재 상태 동기화
    const gameState = gameStates.get(roomId);
    if (gameState && result.status === 'playing') {
      const playerState = gameState.players[sessionId];
      if (playerState) {
        socket.emit('game-state-sync', {
          hand: playerState.hand,
          tableCards: gameState.tableCards,
          tablePile: gameState.tablePile || [],
          currentPlayerId: gameState.turnOrder[gameState.currentIndex] || null,
          revolution: gameState.revolution,
          players: Object.values(gameState.players).map(p => ({
            id: p.id, nickname: p.nickname, cardCount: p.hand.length, finished: p.finished,
          })),
          turnOrder: gameState.turnOrder,
          phase: gameState.phase,
          readyPlayers: [...(readySets.get(roomId) || [])],
          scores: roomScores.get(roomId) || {},
          isHost,
        });

        const timerInfo = turnTimers.get(roomId);
        if (timerInfo) {
          const elapsed = Math.floor((Date.now() - timerInfo.startedAt) / 1000);
          const remaining = Math.max(1, TURN_DURATION - elapsed);
          socket.emit('turn-timer', { playerId: timerInfo.playerId, duration: remaining });
        }
      }
    }
  });

  socket.on('leave-room', ({ sessionId }) => {
    doLeave(sessionId, socket);
  });

  socket.on('start-game', ({ sessionId }) => {
    const session = sessionMap.get(sessionId);
    if (!session) return;
    const roomId = session.roomId;
    const room = getRoom(roomId);
    if (!room || room.hostId !== sessionId) return;
    if (room.players.length < 3) return socket.emit('error', { message: 'need-3-players' });
    doStartGame(roomId);
  });

  socket.on('play-cards', ({ cards, sessionId }) => {
    console.log('[play-cards] received — sessionId:', sessionId, '| cards:', cards);
    const session = sessionMap.get(sessionId);
    if (!session) { console.warn('[play-cards] session 없음:', sessionId); return; }
    const state = gameStates.get(session.roomId);
    if (!state) { console.warn('[play-cards] gameState 없음 — roomId:', session.roomId); return; }
    const expectedPlayer = state.turnOrder[state.currentIndex];
    console.log('[play-cards] currentPlayer:', expectedPlayer, '| requester:', sessionId);
    const result = playCards(state, sessionId, cards);
    if (result.error) { console.warn('[play-cards] error:', result.error); return socket.emit('error', { message: result.error }); }
    gameStates.set(session.roomId, result.state);
    broadcastGameUpdate(session.roomId, result.state, result.events);
    if (!result.events.some(e => e.type === 'game-over')) {
      startTurnTimer(session.roomId, result.state);
    }
  });

  socket.on('pass', ({ sessionId }) => {
    const session = sessionMap.get(sessionId);
    if (!session) return;
    const state = gameStates.get(session.roomId);
    if (!state) return;
    const result = pass(state, sessionId);
    if (result.error) return socket.emit('error', { message: result.error });
    gameStates.set(session.roomId, result.state);
    broadcastGameUpdate(session.roomId, result.state, result.events);
    if (!result.events.some(e => e.type === 'game-over')) {
      startTurnTimer(session.roomId, result.state);
    }
  });

  socket.on('player-ready', ({ sessionId }) => {
    console.log('[player-ready] sessionId:', sessionId);
    const session = sessionMap.get(sessionId);
    console.log('[player-ready] session:', session);
    if (!session?.roomId) { console.warn('[player-ready] session 없음 또는 roomId 없음'); return; }
    const roomId = session.roomId;
    const room = getRoom(roomId);
    console.log('[player-ready] roomId:', roomId, '| room:', room ? `players:${room.players.length}` : 'null');
    if (!room) return;

    if (!readySets.has(roomId)) readySets.set(roomId, new Set());
    readySets.get(roomId).add(sessionId);

    const readyPlayers = [...readySets.get(roomId)];
    const connectedCount = room.players.filter(p => {
      const sess = sessionMap.get(p.id);
      return sess?.socketId && io.sockets.sockets.has(sess.socketId);
    }).length;
    io.to(roomId).emit('ready-updated', { readyPlayers, total: connectedCount });
    if (readyPlayers.length >= connectedCount) {
      io.to(roomId).emit('all-ready');
      setTimeout(() => doStartGame(roomId), 3000);
    }
  });

  socket.on('tax-return', ({ sessionId, cards }) => {
    const session = sessionMap.get(sessionId);
    if (!session?.roomId) return;
    const tax = taxStates.get(session.roomId);
    if (!tax) return;
    const isPresident = sessionId === tax.presidentId;
    const isVP = sessionId === tax.vpId;
    if (!isPresident && !isVP) return;
    if (isPresident && tax.presidentDone) return;
    if (isVP && (!tax.presidentDone || tax.vpDone)) return;
    const expectedCount = isPresident ? 2 : 1;
    if (!Array.isArray(cards) || cards.length !== expectedCount) return;
    clearTurnTimer(session.roomId);
    processTaxReturn(session.roomId, sessionId, cards);
  });

  // 페이지 이동 시 소켓만 끊기므로 즉시 방에서 제거하지 않음
  socket.on('disconnect', () => {
    socketSession.delete(socket.id);
  });

  function doLeave(sessionId, socket) {
    const session = sessionMap.get(sessionId);
    if (!session?.roomId) return;
    const roomId = session.roomId;
    const room = getRoom(roomId);

    socket.leave(roomId);
    session.roomId = null;

    if (room && room.hostId === sessionId && room.players.length > 1) {
      // 방장 퇴장 → 방 강제 해산
      clearTurnTimer(roomId);
      io.to(roomId).emit('room-closed', { reason: 'host-left' });
      const playerIds = closeRoom(roomId);
      roomScores.delete(roomId);
      botPlayers.delete(roomId);
      for (const pid of playerIds) {
        const sess = sessionMap.get(pid);
        if (sess) sess.roomId = null;
      }
    } else {
      const gameState = gameStates.get(roomId);
      if (gameState && gameState.phase === 'playing') {
        // 게임 중 퇴장 → 봇으로 전환
        if (!botPlayers.has(roomId)) botPlayers.set(roomId, new Set());
        botPlayers.get(roomId).add(sessionId);
        io.to(roomId).emit('player-bot', { playerId: sessionId });
        leaveRoom(roomId, sessionId);
        const updatedRoom = getRoom(roomId);
        if (updatedRoom) io.to(roomId).emit('room-updated', { players: publicPlayers(updatedRoom.players) });
        // 남은 인원이 3명 미만이면 방 강제 해산
        if (!updatedRoom || updatedRoom.players.length < 3) {
          clearTurnTimer(roomId);
          io.to(roomId).emit('room-closed', { reason: 'not-enough-players' });
          const playerIds = closeRoom(roomId);
          roomScores.delete(roomId);
          botPlayers.delete(roomId);
          for (const pid of playerIds) {
            const sess = sessionMap.get(pid);
            if (sess) sess.roomId = null;
          }
        } else if (gameState.turnOrder[gameState.currentIndex] === sessionId) {
          // 떠난 플레이어가 현재 차례면 봇 턴 즉시 시작
          clearTurnTimer(roomId);
          startTurnTimer(roomId, gameState);
        }
      } else {
        clearTurnTimer(roomId);
        const updated = leaveRoom(roomId, sessionId);
        if (updated) io.to(roomId).emit('room-updated', { players: publicPlayers(updated.players) });
      }
    }
    io.emit('room-list', { rooms: getRoomList() });
  }

});

function remapRanks(prevRanks, playerIds) {
  const RANK_ORDER = ['president', 'vice-president', 'citizen', 'vice-scum', 'scum'];
  const RANK_MAP = {
    3: ['president', 'citizen', 'scum'],
    4: ['president', 'vice-president', 'vice-scum', 'scum'],
  };
  const n = playerIds.length;
  const newList = RANK_MAP[n] || ['president', 'vice-president', ...Array(n - 4).fill('citizen'), 'vice-scum', 'scum'];
  const sorted = [...playerIds].sort((a, b) =>
    RANK_ORDER.indexOf(prevRanks[a] ?? 'citizen') - RANK_ORDER.indexOf(prevRanks[b] ?? 'citizen')
  );
  const result = {};
  sorted.forEach((id, i) => { result[id] = newList[i]; });
  return result;
}

function doStartGame(roomId) {
  console.log('[doStartGame] roomId:', roomId);
  const room = getRoom(roomId);
  console.log('[doStartGame] room:', room ? `players:${room.players.length}` : 'null');
  if (!room) return;

  // 소켓 연결이 없는 플레이어 제거
  [...room.players].forEach(p => {
    const sess = sessionMap.get(p.id);
    if (!sess?.socketId || !io.sockets.sockets.has(sess.socketId)) {
      leaveRoom(roomId, p.id);
      if (sess) sess.roomId = null;
    }
  });
  botPlayers.delete(roomId);
  readySets.delete(roomId);

  const currentRoom = getRoom(roomId);
  if (!currentRoom || currentRoom.players.length < 3) {
    io.to(roomId).emit('error', { message: 'need-3-players' });
    return;
  }

  const prevState = gameStates.get(roomId);
  const rawPrevRanks = prevState?.ranks || {};
  const prevRanks = Object.keys(rawPrevRanks).length > 0
    ? remapRanks(rawPrevRanks, currentRoom.players.map(p => p.id))
    : {};
  const gameNumber = (prevState?.gameNumber || 0) + 1;

  const players = currentRoom.players.map(p => ({ id: p.id, nickname: p.nickname }));
  let state = createGameState(players, gameNumber, prevRanks);
  setRoomStatus(roomId, 'playing');

  // 2판부터 세금 페이즈
  const presidentId = Object.entries(prevRanks).find(([, r]) => r === 'president')?.[0];
  const scumId      = Object.entries(prevRanks).find(([, r]) => r === 'scum')?.[0];
  const vpId        = Object.entries(prevRanks).find(([, r]) => r === 'vice-president')?.[0];
  const vscumId     = Object.entries(prevRanks).find(([, r]) => r === 'vice-scum')?.[0];

  console.log('[tax-setup] gameNumber:', gameNumber, '| prevRanks:', prevRanks, '| presidentId:', presidentId, '| scumId:', scumId, '| vpId:', vpId, '| vscumId:', vscumId);
  if (gameNumber > 1 && presidentId && scumId && state.players[presidentId] && state.players[scumId]) {
    const scumGave = topNonJoker(state.players[scumId].hand, 2);
    state = {
      ...state,
      phase: 'tax',
      players: {
        ...state.players,
        [scumId]: { ...state.players[scumId], hand: removeCardsFromHand(state.players[scumId].hand, scumGave) },
        [presidentId]: { ...state.players[presidentId], hand: [...state.players[presidentId].hand, ...scumGave] },
      },
    };

    const needsVP = !!(vpId && vscumId && state.players[vpId] && state.players[vscumId]);
    console.log('[tax-setup] needsVP:', needsVP, '| vpId in state:', !!(vpId && state.players[vpId]), '| vscumId in state:', !!(vscumId && state.players[vscumId]));
    let vscumGave = [];
    if (needsVP) {
      vscumGave = topNonJoker(state.players[vscumId].hand, 1);
      state = {
        ...state,
        players: {
          ...state.players,
          [vscumId]: { ...state.players[vscumId], hand: removeCardsFromHand(state.players[vscumId].hand, vscumGave) },
          [vpId]: { ...state.players[vpId], hand: [...state.players[vpId].hand, ...vscumGave] },
        },
      };
    }

    gameStates.set(roomId, state);
    taxStates.set(roomId, { presidentId, scumId, vpId, vscumId, needsVP, presidentDone: false, vpDone: false });

    currentRoom.players.forEach(p => {
      const role = prevRanks[p.id] || 'citizen';
      const taxInfo = {
        role,
        taxGiven:       role === 'scum' ? scumGave : role === 'vice-scum' ? vscumGave : [],
        taxReceived:    role === 'president' ? scumGave : role === 'vice-president' ? vscumGave : [],
        taxReturnCount: role === 'president' ? 2 : role === 'vice-president' && needsVP ? 1 : 0,
      };
      const sess = sessionMap.get(p.id);
      const playerSocket = sess ? io.sockets.sockets.get(sess.socketId) : null;
      if (playerSocket) {
        playerSocket.emit('game-started', {
          hand: state.players[p.id].hand,
          turnOrder: state.turnOrder,
          currentPlayerId: state.turnOrder[state.currentIndex],
          gameNumber, phase: 'tax', taxInfo,
          players: Object.values(state.players).map(q => ({
            id: q.id, nickname: q.nickname, cardCount: q.hand.length, finished: q.finished,
            rank: state.ranks[q.id] || 'citizen',
          })),
        });
      }
    });
    io.emit('room-list', { rooms: getRoomList() });
    startTaxTimer(roomId, presidentId);
    return;
  }

  gameStates.set(roomId, state);
  emitGameStarted(roomId, state, gameNumber);
  io.emit('room-list', { rooms: getRoomList() });
  startTurnTimer(roomId, state);
}

function emitGameStarted(roomId, state, gameNumber) {
  const room = getRoom(roomId);
  if (!room) return;
  room.players.forEach(p => {
    const sess = sessionMap.get(p.id);
    const playerSocket = sess ? io.sockets.sockets.get(sess.socketId) : null;
    if (playerSocket) {
      playerSocket.emit('game-started', {
        hand: state.players[p.id].hand,
        turnOrder: state.turnOrder,
        currentPlayerId: state.turnOrder[state.currentIndex],
        gameNumber,
        players: Object.values(state.players).map(q => ({
          id: q.id, nickname: q.nickname, cardCount: q.hand.length, finished: q.finished,
          rank: state.ranks[q.id] || 'citizen',
        })),
      });
    }
  });
}

function removeCardsFromHand(hand, cards) {
  const h = [...hand];
  for (const c of cards) { const i = h.indexOf(c); if (i !== -1) h.splice(i, 1); }
  return h;
}

function startTaxTimer(roomId, playerId) {
  clearTurnTimer(roomId);
  io.to(roomId).emit('turn-timer', { playerId, duration: TURN_DURATION });
  const timeoutId = setTimeout(() => {
    turnTimers.delete(roomId);
    const state = gameStates.get(roomId);
    const tax = taxStates.get(roomId);
    if (!state || !tax) return;
    const isPresident = playerId === tax.presidentId;
    const count = isPresident ? 2 : 1;
    const hand = [...state.players[playerId].hand];
    const cards = [];
    for (let i = 0; i < count && hand.length > 0; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      cards.push(...hand.splice(idx, 1));
    }
    processTaxReturn(roomId, playerId, cards);
  }, TURN_DURATION * 1000);
  turnTimers.set(roomId, { timeoutId, startedAt: Date.now(), playerId });
}

function processTaxReturn(roomId, giverId, cards) {
  const tax = taxStates.get(roomId);
  const state = gameStates.get(roomId);
  if (!tax || !state) return;
  const isPresident = giverId === tax.presidentId;
  const targetId = isPresident ? tax.scumId : tax.vscumId;
  console.log('[processTaxReturn] giverId:', giverId, '| isPresident:', isPresident, '| needsVP:', tax.needsVP, '| presidentDone:', tax.presidentDone, '| vpDone:', tax.vpDone);

  const giverHand = removeCardsFromHand(state.players[giverId].hand, cards);
  const targetHand = [...state.players[targetId].hand, ...cards];
  let newState = {
    ...state,
    players: {
      ...state.players,
      [giverId]: { ...state.players[giverId], hand: giverHand },
      [targetId]: { ...state.players[targetId], hand: targetHand },
    },
  };

  [giverId, targetId].forEach(pid => {
    const sess = sessionMap.get(pid);
    const sock = sess ? io.sockets.sockets.get(sess.socketId) : null;
    if (sock) sock.emit('hand-updated', { hand: newState.players[pid].hand });
  });
  io.to(roomId).emit('tax-returned', { giverId, targetId, cardCount: cards.length });

  if (isPresident) {
    tax.presidentDone = true;
    if (tax.needsVP) {
      gameStates.set(roomId, newState);
      startTaxTimer(roomId, tax.vpId);
    } else {
      finishTaxPhase(roomId, newState);
    }
  } else {
    tax.vpDone = true;
    finishTaxPhase(roomId, newState);
  }
}

function finishTaxPhase(roomId, state) {
  taxStates.delete(roomId);
  const playingState = { ...state, phase: 'playing' };
  gameStates.set(roomId, playingState);
  io.to(roomId).emit('tax-phase-end', {
    currentPlayerId: playingState.turnOrder[playingState.currentIndex],
  });
  startTurnTimer(roomId, playingState);
}

function publicPlayers(players) {
  return players.map(p => ({ id: p.id, nickname: p.nickname }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
